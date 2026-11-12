package hub

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// DomainMonitor represents a domain/endpoint being monitored
type DomainMonitor struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	URL            string    `json:"url"`
	ServerID       string    `json:"serverId,omitempty"`
	ServerName     string    `json:"serverName,omitempty"`
	Status         string    `json:"status"` // "up", "degraded", "down", "pending"
	StatusCode     int       `json:"statusCode"`
	ResponseTimeMs int64     `json:"responseTimeMs"`
	Cloudflare     bool      `json:"cloudflare"`
	CFProxied      bool      `json:"cfProxied"`
	LastChecked    time.Time `json:"lastChecked"`
	CheckInterval  int       `json:"checkInterval"` // in minutes
	SSL            SSLInfo   `json:"ssl"`
}

type SSLInfo struct {
	Valid         bool      `json:"valid"`
	Issuer        string    `json:"issuer"`
	ExpiresAt     time.Time `json:"expiresAt"`
	DaysRemaining int       `json:"daysRemaining"`
	Status        string    `json:"status"` // "valid", "warning", "expired", "none"
}

// AlertPolicy represents an alert policy that can be applied to servers or domains
type AlertPolicy struct {
	ID          string               `json:"id"`
	Name        string               `json:"name"`
	Description string               `json:"description"`
	Enabled     bool                 `json:"enabled"`
	Rules       AlertPolicyRules     `json:"rules"`
	Channels    AlertPolicyChannels  `json:"channels"`
	Targets     []string             `json:"targets"` // ["*"] for all, or specific system IDs / domain IDs
	UpdatedAt   time.Time            `json:"updatedAt"`
}

type AlertPolicyRules struct {
	CPUThreshold     int  `json:"cpuThreshold"`     // e.g. 85%
	MemoryThreshold  int  `json:"memoryThreshold"`  // e.g. 90%
	DiskThreshold    int  `json:"diskThreshold"`    // e.g. 90%
	SystemDown       bool `json:"systemDown"`       // Alert on server offline
	ContainerDown    bool `json:"containerDown"`    // Alert on container exit
	DomainDown       bool `json:"domainDown"`       // Alert on HTTP != 200
	SSLExpiringDays  int  `json:"sslExpiringDays"`  // Alert if SSL expires in <= N days (e.g. 14)
}

type AlertPolicyChannels struct {
	DiscordWebhook  string `json:"discordWebhook"`
	TelegramBot     string `json:"telegramBot"`    // Bot Token
	TelegramChatID  string `json:"telegramChatId"` // Chat ID
	SlackWebhook    string `json:"slackWebhook"`
	CustomWebhook   string `json:"customWebhook"`
	Email           string `json:"email"`
}

// CloudflareSettings holds Cloudflare connection settings
type CloudflareSettings struct {
	APIToken   string    `json:"apiToken"`
	AccountID  string    `json:"accountId,omitempty"`
	Verified   bool      `json:"verified"`
	LastSynced time.Time `json:"lastSynced,omitempty"`
}

// DockMonManager coordinates domain checks, Cloudflare integration, and alert policies
type DockMonManager struct {
	hub          *Hub
	mu           sync.RWMutex
	domains      map[string]*DomainMonitor
	policies     map[string]*AlertPolicy
	cfSettings   CloudflareSettings
	domainsFile  string
	policiesFile string
	cfFile       string
	stopChan     chan struct{}
}

func newDockMonManager(hub *Hub) *DockMonManager {
	dataDir := hub.DataDir()
	dm := &DockMonManager{
		hub:          hub,
		domains:      make(map[string]*DomainMonitor),
		policies:     make(map[string]*AlertPolicy),
		domainsFile:  filepath.Join(dataDir, "dockmon_domains.json"),
		policiesFile: filepath.Join(dataDir, "dockmon_policies.json"),
		cfFile:       filepath.Join(dataDir, "dockmon_cloudflare.json"),
		stopChan:     make(chan struct{}),
	}
	dm.load()
	return dm
}

func (dm *DockMonManager) load() {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	// Load domains
	if data, err := os.ReadFile(dm.domainsFile); err == nil {
		var list []*DomainMonitor
		if err := json.Unmarshal(data, &list); err == nil {
			for _, d := range list {
				dm.domains[d.ID] = d
			}
		}
	}

	// Load policies
	if data, err := os.ReadFile(dm.policiesFile); err == nil {
		var list []*AlertPolicy
		if err := json.Unmarshal(data, &list); err == nil {
			for _, p := range list {
				dm.policies[p.ID] = p
			}
		}
	} else {
		// Create default policy if none exists
		defaultPolicy := &AlertPolicy{
			ID:          "policy_default",
			Name:        "Default Production Policy",
			Description: "Standard alerts for CPU > 85%, Memory > 90%, Server Down, Domain Down & SSL < 14 days",
			Enabled:     true,
			Rules: AlertPolicyRules{
				CPUThreshold:    85,
				MemoryThreshold: 90,
				DiskThreshold:   90,
				SystemDown:      true,
				ContainerDown:   true,
				DomainDown:      true,
				SSLExpiringDays: 14,
			},
			Channels:  AlertPolicyChannels{},
			Targets:   []string{"*"},
			UpdatedAt: time.Now(),
		}
		dm.policies[defaultPolicy.ID] = defaultPolicy
	}

	// Load Cloudflare settings
	if data, err := os.ReadFile(dm.cfFile); err == nil {
		_ = json.Unmarshal(data, &dm.cfSettings)
	}
}

func (dm *DockMonManager) saveDomains() error {
	var list []*DomainMonitor
	for _, d := range dm.domains {
		list = append(list, d)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(dm.domainsFile, data, 0644)
}

func (dm *DockMonManager) savePolicies() error {
	var list []*AlertPolicy
	for _, p := range dm.policies {
		list = append(list, p)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(dm.policiesFile, data, 0644)
}

func (dm *DockMonManager) saveCFSettings() error {
	data, err := json.MarshalIndent(dm.cfSettings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(dm.cfFile, data, 0644)
}

// checkDomain performs real-time HTTP and SSL probe on target URL
func checkDomain(targetURL string) (statusCode int, latencyMs int64, ssl SSLInfo, err error) {
	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		targetURL = "https://" + targetURL
	}

	start := time.Now()
	client := &http.Client{
		Timeout: 7 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: false,
			},
			DialContext: (&net.Dialer{
				Timeout: 5 * time.Second,
			}).DialContext,
		},
	}

	resp, err := client.Get(targetURL)
	latencyMs = time.Since(start).Milliseconds()

	if err != nil {
		// Try extracting domain host to check SSL even if HTTP failed
		host := strings.TrimPrefix(targetURL, "https://")
		host = strings.TrimPrefix(host, "http://")
		if idx := strings.Index(host, "/"); idx != -1 {
			host = host[:idx]
		}
		if !strings.Contains(host, ":") {
			host = host + ":443"
		}
		ssl = probeSSL(host)
		return 0, latencyMs, ssl, err
	}
	defer resp.Body.Close()

	statusCode = resp.StatusCode

	if resp.TLS != nil && len(resp.TLS.PeerCertificates) > 0 {
		cert := resp.TLS.PeerCertificates[0]
		now := time.Now()
		daysLeft := int(cert.NotAfter.Sub(now).Hours() / 24)

		sslStatus := "valid"
		if daysLeft <= 0 {
			sslStatus = "expired"
		} else if daysLeft <= 14 {
			sslStatus = "warning"
		}

		issuer := cert.Issuer.CommonName
		if issuer == "" && len(cert.Issuer.Organization) > 0 {
			issuer = cert.Issuer.Organization[0]
		}

		ssl = SSLInfo{
			Valid:         daysLeft > 0,
			Issuer:        issuer,
			ExpiresAt:     cert.NotAfter,
			DaysRemaining: daysLeft,
			Status:        sslStatus,
		}
	} else {
		ssl = SSLInfo{
			Valid:  false,
			Status: "none",
		}
	}

	return statusCode, latencyMs, ssl, nil
}

func probeSSL(hostWithPort string) SSLInfo {
	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 4 * time.Second}, "tcp", hostWithPort, &tls.Config{
		InsecureSkipVerify: true,
	})
	if err != nil {
		return SSLInfo{Valid: false, Status: "none"}
	}
	defer conn.Close()

	certs := conn.ConnectionState().PeerCertificates
	if len(certs) == 0 {
		return SSLInfo{Valid: false, Status: "none"}
	}

	cert := certs[0]
	now := time.Now()
	daysLeft := int(cert.NotAfter.Sub(now).Hours() / 24)

	sslStatus := "valid"
	if daysLeft <= 0 {
		sslStatus = "expired"
	} else if daysLeft <= 14 {
		sslStatus = "warning"
	}

	issuer := cert.Issuer.CommonName
	if issuer == "" && len(cert.Issuer.Organization) > 0 {
		issuer = cert.Issuer.Organization[0]
	}

	return SSLInfo{
		Valid:         daysLeft > 0,
		Issuer:        issuer,
		ExpiresAt:     cert.NotAfter,
		DaysRemaining: daysLeft,
		Status:        sslStatus,
	}
}

// StartBackgroundWorkers starts periodic domain probing and alert checks
func (dm *DockMonManager) StartBackgroundWorkers() {
	go func() {
		ticker := time.NewTicker(3 * time.Minute)
		defer ticker.Stop()

		// Run one initial check shortly after startup
		time.Sleep(10 * time.Second)
		dm.CheckAllDomains()

		for {
			select {
			case <-ticker.C:
				dm.CheckAllDomains()
			case <-dm.stopChan:
				return
			}
		}
	}()
}

// CheckAllDomains checks all configured domain monitors
func (dm *DockMonManager) CheckAllDomains() {
	dm.mu.RLock()
	var toCheck []*DomainMonitor
	for _, d := range dm.domains {
		toCheck = append(toCheck, d)
	}
	dm.mu.RUnlock()

	for _, d := range toCheck {
		code, lat, ssl, err := checkDomain(d.URL)
		dm.mu.Lock()
		if cur, ok := dm.domains[d.ID]; ok {
			cur.StatusCode = code
			cur.ResponseTimeMs = lat
			cur.SSL = ssl
			cur.LastChecked = time.Now()

			if err != nil || (code >= 400 && code != 401 && code != 403) {
				cur.Status = "down"
				go dm.triggerDomainAlert(cur, fmt.Sprintf("Domain %s is DOWN (Status %d)", cur.Name, code))
			} else if ssl.Status == "warning" || ssl.Status == "expired" {
				cur.Status = "degraded"
				if ssl.Status == "expired" {
					go dm.triggerDomainAlert(cur, fmt.Sprintf("SSL certificate for %s has EXPIRED", cur.Name))
				} else if ssl.DaysRemaining <= 7 {
					go dm.triggerDomainAlert(cur, fmt.Sprintf("SSL certificate for %s expires in %d days", cur.Name, ssl.DaysRemaining))
				}
			} else {
				cur.Status = "up"
			}
		}
		dm.mu.Unlock()
	}
	_ = dm.saveDomains()
}

// triggerDomainAlert dispatches alerts to policy channels
func (dm *DockMonManager) triggerDomainAlert(d *DomainMonitor, message string) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	for _, policy := range dm.policies {
		if !policy.Enabled {
			continue
		}
		match := false
		for _, target := range policy.Targets {
			if target == "*" || target == d.ID || target == d.ServerID {
				match = true
				break
			}
		}
		if !match {
			continue
		}

		sendAlertNotification(policy.Channels, "DockMon Alert: "+d.Name, message)
	}
}

// sendAlertNotification sends notification to configured webhooks
func sendAlertNotification(ch AlertPolicyChannels, title, message string) {
	client := &http.Client{Timeout: 5 * time.Second}

	// Discord
	if ch.DiscordWebhook != "" {
		payload := map[string]interface{}{
			"embeds": []map[string]interface{}{
				{
					"title":       title,
					"description": message,
					"color":       15158332, // Red
					"footer": map[string]string{
						"text": "DockMon Monitoring",
					},
					"timestamp": time.Now().Format(time.RFC3339),
				},
			},
		}
		if b, err := json.Marshal(payload); err == nil {
			_, _ = client.Post(ch.DiscordWebhook, "application/json", bytes.NewBuffer(b))
		}
	}

	// Telegram
	if ch.TelegramBot != "" && ch.TelegramChatID != "" {
		tgURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", ch.TelegramBot)
		payload := map[string]interface{}{
			"chat_id":    ch.TelegramChatID,
			"text":       fmt.Sprintf("⚠️ *%s*\n\n%s", title, message),
			"parse_mode": "Markdown",
		}
		if b, err := json.Marshal(payload); err == nil {
			_, _ = client.Post(tgURL, "application/json", bytes.NewBuffer(b))
		}
	}

	// Slack
	if ch.SlackWebhook != "" {
		payload := map[string]interface{}{
			"text": fmt.Sprintf(":warning: *%s*\n%s", title, message),
		}
		if b, err := json.Marshal(payload); err == nil {
			_, _ = client.Post(ch.SlackWebhook, "application/json", bytes.NewBuffer(b))
		}
	}

	// Custom Webhook
	if ch.CustomWebhook != "" {
		payload := map[string]interface{}{
			"event":     "alert",
			"title":     title,
			"message":   message,
			"timestamp": time.Now().Unix(),
		}
		if b, err := json.Marshal(payload); err == nil {
			_, _ = client.Post(ch.CustomWebhook, "application/json", bytes.NewBuffer(b))
		}
	}
}

// registerDockMonRoutes registers all custom DockMon REST endpoints
func (h *Hub) registerDockMonRoutes(se *core.ServeEvent, dm *DockMonManager) {
	api := se.Router.Group("/api/dockmon")
	api.Bind(apis.RequireAuth())

	// Public ping/health check
	se.Router.GET("/api/dockmon/status", func(e *core.RequestEvent) error {
		return e.JSON(http.StatusOK, map[string]interface{}{
			"app":     "dockmon",
			"version": "1.0.0",
			"status":  "healthy",
		})
	})

	// ---------------- DOMAINS ----------------

	// GET /api/dockmon/domains
	api.GET("/domains", func(e *core.RequestEvent) error {
		dm.mu.RLock()
		defer dm.mu.RUnlock()
		var list []*DomainMonitor
		for _, d := range dm.domains {
			list = append(list, d)
		}
		return e.JSON(http.StatusOK, list)
	})

	// POST /api/dockmon/domains
	api.POST("/domains", func(e *core.RequestEvent) error {
		var req struct {
			Name       string `json:"name"`
			URL        string `json:"url"`
			ServerID   string `json:"serverId"`
			ServerName string `json:"serverName"`
		}
		if err := e.BindBody(&req); err != nil {
			return e.BadRequestError("Invalid request payload", err)
		}
		if req.URL == "" {
			return e.BadRequestError("URL is required", nil)
		}
		if req.Name == "" {
			req.Name = req.URL
		}

		dm.mu.Lock()
		id := fmt.Sprintf("dom_%d", time.Now().UnixNano()%1000000)
		d := &DomainMonitor{
			ID:            id,
			Name:          req.Name,
			URL:           req.URL,
			ServerID:      req.ServerID,
			ServerName:    req.ServerName,
			Status:        "pending",
			CheckInterval: 5,
		}
		dm.domains[id] = d
		dm.mu.Unlock()

		// Run initial check asynchronously
		go func(dom *DomainMonitor) {
			code, lat, ssl, err := checkDomain(dom.URL)
			dm.mu.Lock()
			dom.StatusCode = code
			dom.ResponseTimeMs = lat
			dom.SSL = ssl
			dom.LastChecked = time.Now()
			if err != nil || (code >= 400 && code != 401 && code != 403) {
				dom.Status = "down"
			} else if ssl.Status == "warning" || ssl.Status == "expired" {
				dom.Status = "degraded"
			} else {
				dom.Status = "up"
			}
			_ = dm.saveDomains()
			dm.mu.Unlock()
		}(d)

		_ = dm.saveDomains()
		return e.JSON(http.StatusOK, d)
	})

	// POST /api/dockmon/domains/:id/check (Check domain on-demand)
	api.POST("/domains/{id}/check", func(e *core.RequestEvent) error {
		id := e.Request.PathValue("id")
		dm.mu.RLock()
		d, exists := dm.domains[id]
		dm.mu.RUnlock()
		if !exists {
			return e.NotFoundError("Domain not found", nil)
		}

		code, lat, ssl, err := checkDomain(d.URL)
		dm.mu.Lock()
		d.StatusCode = code
		d.ResponseTimeMs = lat
		d.SSL = ssl
		d.LastChecked = time.Now()
		if err != nil || (code >= 400 && code != 401 && code != 403) {
			d.Status = "down"
		} else if ssl.Status == "warning" || ssl.Status == "expired" {
			d.Status = "degraded"
		} else {
			d.Status = "up"
		}
		_ = dm.saveDomains()
		dm.mu.Unlock()

		return e.JSON(http.StatusOK, d)
	})

	// DELETE /api/dockmon/domains/:id
	api.DELETE("/domains/{id}", func(e *core.RequestEvent) error {
		id := e.Request.PathValue("id")
		dm.mu.Lock()
		delete(dm.domains, id)
		_ = dm.saveDomains()
		dm.mu.Unlock()
		return e.JSON(http.StatusOK, map[string]bool{"success": true})
	})

	// ---------------- CLOUDFLARE ----------------

	// GET /api/dockmon/cloudflare
	api.GET("/cloudflare", func(e *core.RequestEvent) error {
		dm.mu.RLock()
		defer dm.mu.RUnlock()
		safeSettings := dm.cfSettings
		if len(safeSettings.APIToken) > 8 {
			safeSettings.APIToken = safeSettings.APIToken[:4] + "..." + safeSettings.APIToken[len(safeSettings.APIToken)-4:]
		}
		return e.JSON(http.StatusOK, safeSettings)
	})

	// POST /api/dockmon/cloudflare/verify
	api.POST("/cloudflare/verify", func(e *core.RequestEvent) error {
		var req struct {
			APIToken string `json:"apiToken"`
		}
		if err := e.BindBody(&req); err != nil {
			return e.BadRequestError("Invalid request", err)
		}
		if req.APIToken == "" {
			return e.BadRequestError("API Token required", nil)
		}

		client := &http.Client{Timeout: 8 * time.Second}
		cfReq, _ := http.NewRequest("GET", "https://api.cloudflare.com/client/v4/user/tokens/verify", nil)
		cfReq.Header.Set("Authorization", "Bearer "+req.APIToken)

		resp, err := client.Do(cfReq)
		if err != nil {
			return e.JSON(http.StatusBadRequest, map[string]interface{}{"valid": false, "error": err.Error()})
		}
		defer resp.Body.Close()

		var cfResp struct {
			Success bool `json:"success"`
			Messages []struct {
				Message string `json:"message"`
			} `json:"messages"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&cfResp)

		if cfResp.Success {
			dm.mu.Lock()
			dm.cfSettings.APIToken = req.APIToken
			dm.cfSettings.Verified = true
			dm.cfSettings.LastSynced = time.Now()
			_ = dm.saveCFSettings()
			dm.mu.Unlock()
			return e.JSON(http.StatusOK, map[string]interface{}{"valid": true, "message": "Token verified successfully"})
		}

		return e.JSON(http.StatusOK, map[string]interface{}{"valid": false, "error": "Cloudflare rejected the token"})
	})

	// GET /api/dockmon/cloudflare/zones
	api.GET("/cloudflare/zones", func(e *core.RequestEvent) error {
		dm.mu.RLock()
		token := dm.cfSettings.APIToken
		dm.mu.RUnlock()

		if token == "" {
			return e.BadRequestError("Cloudflare API Token not configured", nil)
		}

		client := &http.Client{Timeout: 10 * time.Second}
		cfReq, _ := http.NewRequest("GET", "https://api.cloudflare.com/client/v4/zones?per_page=50", nil)
		cfReq.Header.Set("Authorization", "Bearer "+token)

		resp, err := client.Do(cfReq)
		if err != nil {
			return e.BadRequestError("Failed to reach Cloudflare API: "+err.Error(), nil)
		}
		defer resp.Body.Close()

		var result map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return e.BadRequestError("Failed to parse Cloudflare response", err)
		}

		return e.JSON(http.StatusOK, result)
	})

	// POST /api/dockmon/cloudflare/import (Import selected domains from Cloudflare)
	api.POST("/cloudflare/import", func(e *core.RequestEvent) error {
		var req struct {
			Domains []struct {
				Name    string `json:"name"`
				Proxied bool   `json:"proxied"`
			} `json:"domains"`
		}
		if err := e.BindBody(&req); err != nil {
			return e.BadRequestError("Invalid request", err)
		}

		dm.mu.Lock()
		count := 0
		for _, item := range req.Domains {
			// Check if already exists
			exists := false
			for _, d := range dm.domains {
				if d.Name == item.Name || d.URL == "https://"+item.Name {
					exists = true
					break
				}
			}
			if !exists {
				id := fmt.Sprintf("dom_%d", time.Now().UnixNano()%1000000)
				d := &DomainMonitor{
					ID:            id,
					Name:          item.Name,
					URL:           "https://" + item.Name,
					Status:        "pending",
					Cloudflare:    true,
					CFProxied:     item.Proxied,
					CheckInterval: 5,
				}
				dm.domains[id] = d
				count++
				// probe in background
				go func(dom *DomainMonitor) {
					code, lat, ssl, err := checkDomain(dom.URL)
					dm.mu.Lock()
					dom.StatusCode = code
					dom.ResponseTimeMs = lat
					dom.SSL = ssl
					dom.LastChecked = time.Now()
					if err != nil || (code >= 400 && code != 401 && code != 403) {
						dom.Status = "down"
					} else if ssl.Status == "warning" || ssl.Status == "expired" {
						dom.Status = "degraded"
					} else {
						dom.Status = "up"
					}
					_ = dm.saveDomains()
					dm.mu.Unlock()
				}(d)
			}
		}
		_ = dm.saveDomains()
		dm.mu.Unlock()

		return e.JSON(http.StatusOK, map[string]interface{}{
			"success":  true,
			"imported": count,
		})
	})

	// ---------------- ALERT POLICIES ----------------

	// GET /api/dockmon/alert-policies
	api.GET("/alert-policies", func(e *core.RequestEvent) error {
		dm.mu.RLock()
		defer dm.mu.RUnlock()
		var list []*AlertPolicy
		for _, p := range dm.policies {
			list = append(list, p)
		}
		return e.JSON(http.StatusOK, list)
	})

	// POST /api/dockmon/alert-policies
	api.POST("/alert-policies", func(e *core.RequestEvent) error {
		var policy AlertPolicy
		if err := e.BindBody(&policy); err != nil {
			return e.BadRequestError("Invalid payload", err)
		}
		if policy.Name == "" {
			return e.BadRequestError("Policy name is required", nil)
		}

		dm.mu.Lock()
		if policy.ID == "" {
			policy.ID = fmt.Sprintf("pol_%d", time.Now().UnixNano()%1000000)
		}
		policy.UpdatedAt = time.Now()
		dm.policies[policy.ID] = &policy
		_ = dm.savePolicies()
		dm.mu.Unlock()

		return e.JSON(http.StatusOK, policy)
	})

	// DELETE /api/dockmon/alert-policies/:id
	api.DELETE("/alert-policies/{id}", func(e *core.RequestEvent) error {
		id := e.Request.PathValue("id")
		dm.mu.Lock()
		delete(dm.policies, id)
		_ = dm.savePolicies()
		dm.mu.Unlock()
		return e.JSON(http.StatusOK, map[string]bool{"success": true})
	})

	// POST /api/dockmon/alert-policies/test (Send test notification)
	api.POST("/alert-policies/test", func(e *core.RequestEvent) error {
		var channels AlertPolicyChannels
		if err := e.BindBody(&channels); err != nil {
			return e.BadRequestError("Invalid payload", err)
		}
		sendAlertNotification(channels, "DockMon Test Alert", "This is a test notification from DockMon Alert Policy.")
		return e.JSON(http.StatusOK, map[string]bool{"sent": true})
	})
}
