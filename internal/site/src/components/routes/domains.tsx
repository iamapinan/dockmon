import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { pb } from "@/lib/api"
import { $systems } from "@/lib/stores"
import { useStore } from "@nanostores/react"
import {
	Globe,
	Plus,
	RefreshCw,
	ShieldCheck,
	ShieldAlert,
	ShieldX,
	ExternalLink,
	Cloud,
	Trash2,
	Server,
	Search,
	CheckCircle2,
	Radio,
} from "lucide-react"
import { CloudflareDialog } from "./cloudflare-dialog"
import { CloudflareDNSView } from "./cloudflare-dns"

export interface DomainItem {
	id: string
	name: string
	url: string
	serverId?: string
	serverName?: string
	status: "up" | "degraded" | "down" | "pending"
	statusCode: number
	responseTimeMs: number
	cloudflare: boolean
	cfProxied: boolean
	lastChecked: string
	checkInterval: number
	ssl: {
		valid: boolean
		issuer: string
		expiresAt: string
		daysRemaining: number
		status: "valid" | "warning" | "expired" | "none"
	}
}

export interface CFServerDomainRecord {
	id: string
	zoneId: string
	zoneName: string
	name: string
	type: string
	content: string
	proxied: boolean
	ttl: number
	isMonitored?: boolean
	monitorId?: string
}

export default function Domains() {
	const systems = useStore($systems)
	const [domains, setDomains] = useState<DomainItem[]>([])
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState("")
	const [filter, setFilter] = useState<"all" | "up" | "degraded" | "down">("all")
	const [selectedServerId, setSelectedServerId] = useState<string>("all")

	// Cloudflare Host Domains
	const [serverDomainsMap, setServerDomainsMap] = useState<Record<string, { count: number; domains: CFServerDomainRecord[] }>>({})
	const [loadingServerDomains, setLoadingServerDomains] = useState(false)
	const [addingMonitor, setAddingMonitor] = useState<string | null>(null)

	const [addOpen, setAddOpen] = useState(false)
	const [cfOpen, setCfOpen] = useState(false)
	const [newUrl, setNewUrl] = useState("")
	const [newName, setNewName] = useState("")
	const [newServerId, setNewServerId] = useState("")
	const [checkingId, setCheckingId] = useState<string | null>(null)

	const fetchDomains = async () => {
		try {
			const res = await pb.send<DomainItem[]>("/api/dockmon/domains", {})
			setDomains(res || [])
		} catch (err) {
			console.error("Failed to fetch domains", err)
		} finally {
			setLoading(false)
		}
	}

	const fetchServerDomains = async (refresh = false) => {
		setLoadingServerDomains(true)
		try {
			const res = await pb.send<{
				byServer: Record<string, { serverId: string; serverName: string; host: string; domains: CFServerDomainRecord[]; count: number }>
			}>(`/api/dockmon/cloudflare/records-by-server${refresh ? "?refresh=true" : ""}`, {})
			if (res?.byServer) {
				const map: Record<string, { count: number; domains: CFServerDomainRecord[] }> = {}
				for (const [sId, group] of Object.entries(res.byServer)) {
					map[sId] = {
						count: group.count,
						domains: group.domains || [],
					}
				}
				setServerDomainsMap(map)
			}
		} catch (err) {
			console.error("Failed to fetch records by server", err)
		} finally {
			setLoadingServerDomains(false)
		}
	}

	useEffect(() => {
		fetchDomains()
		fetchServerDomains()
		const timer = setInterval(fetchDomains, 15000)
		return () => clearInterval(timer)
	}, [])

	const handleAddDomain = async () => {
		if (!newUrl) return
		const selectedSystem = systems.find((s) => s.id === newServerId)
		try {
			await pb.send("/api/dockmon/domains", {
				method: "POST",
				body: {
					name: newName || newUrl,
					url: newUrl,
					serverId: newServerId,
					serverName: selectedSystem?.name || "",
				},
			})
			setAddOpen(false)
			setNewUrl("")
			setNewName("")
			setNewServerId("")
			fetchDomains()
			fetchServerDomains(true)
		} catch (err) {
			console.error("Failed to add domain", err)
		}
	}

	const handleAddCloudflareRecordToMonitor = async (record: CFServerDomainRecord, targetServerId: string) => {
		setAddingMonitor(record.id)
		const cleanDomain = record.name.replace(/^\*\./, "")
		const url = `https://${cleanDomain}`
		const targetSystem = systems.find((s) => s.id === targetServerId)

		try {
			await pb.send("/api/dockmon/domains", {
				method: "POST",
				body: {
					name: record.name,
					url,
					serverId: targetServerId,
					serverName: targetSystem?.name || "",
				},
			})
			await fetchDomains()
			await fetchServerDomains(true)
		} catch (err: any) {
			alert(`Failed to add monitor: ${err.message || err}`)
		} finally {
			setAddingMonitor(null)
		}
	}

	const handleCheckDomain = async (id: string) => {
		setCheckingId(id)
		try {
			const updated = await pb.send<DomainItem>(`/api/dockmon/domains/${id}/check`, {
				method: "POST",
			})
			setDomains((prev) => prev.map((d) => (d.id === id ? updated : d)))
		} catch (err) {
			console.error("Failed to check domain", err)
		} finally {
			setCheckingId(null)
		}
	}

	const handleDeleteDomain = async (id: string) => {
		if (!confirm("Are you sure you want to remove this domain monitor?")) return
		try {
			await pb.send(`/api/dockmon/domains/${id}`, { method: "DELETE" })
			setDomains((prev) => prev.filter((d) => d.id !== id))
			fetchServerDomains(true)
		} catch (err) {
			console.error("Failed to delete domain", err)
		}
	}

	// Active server
	const activeServer = systems.find((s) => s.id === selectedServerId)
	const activeServerCFDomains = selectedServerId !== "all" ? (serverDomainsMap[selectedServerId]?.domains || []) : []

	const filteredDomains = domains.filter((d) => {
		const matchesSearch =
			d.name.toLowerCase().includes(search.toLowerCase()) ||
			d.url.toLowerCase().includes(search.toLowerCase()) ||
			(d.serverName && d.serverName.toLowerCase().includes(search.toLowerCase()))
		const matchesFilter = filter === "all" || d.status === filter
		const matchesServer =
			selectedServerId === "all" ||
			d.serverId === selectedServerId ||
			(activeServer && (d.url.includes(activeServer.host) || (activeServerCFDomains.some((cf) => d.url.includes(cf.name.replace(/^\*\./, ""))))))
		return matchesSearch && matchesFilter && matchesServer
	})

	const countUp = domains.filter((d) => d.status === "up").length
	const countDegraded = domains.filter((d) => d.status === "degraded").length
	const countDown = domains.filter((d) => d.status === "down").length

	return (
		<div className="space-y-6 pb-12">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
						<Globe className="h-6 w-6 text-primary" />
						Domains & DNS Management
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Real-time HTTP health, latency, SSL expiration monitoring, and Cloudflare DNS server mapping.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						className="gap-2 border-amber-500/30 hover:border-amber-500 text-amber-500 hover:text-amber-400"
						onClick={() => setCfOpen(true)}
					>
						<Cloud className="h-4 w-4" />
						Cloudflare Connect
					</Button>
					<Button className="gap-2" onClick={() => setAddOpen(true)}>
						<Plus className="h-4 w-4" />
						Add Domain
					</Button>
				</div>
			</div>

			{/* Server Selector Bar */}
			<div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border bg-card/60 backdrop-blur">
				<div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 px-2">
					<Server className="h-3.5 w-3.5 text-primary" />
					<span>Filter by Server:</span>
				</div>
				<Button
					variant={selectedServerId === "all" ? "default" : "outline"}
					size="sm"
					className="h-7 text-xs gap-1.5"
					onClick={() => setSelectedServerId("all")}
				>
					<Globe className="h-3 w-3" />
					All Servers & Domains
				</Button>
				{systems.map((s) => {
					const cfCount = serverDomainsMap[s.id]?.count || 0
					const isSelected = selectedServerId === s.id
					return (
						<Button
							key={s.id}
							variant={isSelected ? "default" : "outline"}
							size="sm"
							className={`h-7 text-xs gap-1.5 ${isSelected ? "" : "border-border/70"}`}
							onClick={() => setSelectedServerId(s.id)}
						>
							<span
								className={`h-2 w-2 rounded-full ${
									s.status === "up" ? "bg-emerald-500" : "bg-red-500"
								}`}
							/>
							<span className="font-medium">{s.name}</span>
							<span className="text-[10px] text-muted-foreground font-mono">({s.host})</span>
							{cfCount > 0 && (
								<span
									className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
										isSelected
											? "bg-primary-foreground/20 text-primary-foreground"
											: "bg-amber-500/15 text-amber-500 border border-amber-500/20"
									}`}
									title={`${cfCount} domain(s) in Cloudflare point to this server`}
								>
									{cfCount} CF
								</span>
							)}
						</Button>
					)
				})}
			</div>

			{/* Cloudflare Host Domains Banner (when a server is selected) */}
			{activeServer && (
				<div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
						<div className="flex items-center gap-2">
							<Cloud className="h-5 w-5 text-amber-500" />
							<div>
								<div className="text-sm font-semibold flex items-center gap-2">
									<span>Cloudflare Domains pointing to {activeServer.name}</span>
									<span className="text-xs px-2 py-0.5 rounded bg-muted font-mono text-muted-foreground">
										{activeServer.host}
									</span>
								</div>
								<div className="text-xs text-muted-foreground">
									{activeServerCFDomains.length > 0
										? `Found ${activeServerCFDomains.length} Cloudflare DNS record(s) routing directly to this server IP.`
										: `No DNS records in Cloudflare currently route to IP ${activeServer.host}.`}
								</div>
							</div>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="h-7 text-xs gap-1.5 self-start sm:self-auto"
							disabled={loadingServerDomains}
							onClick={() => fetchServerDomains(true)}
						>
							<RefreshCw className={`h-3 w-3 ${loadingServerDomains ? "animate-spin" : ""}`} />
							Sync Cloudflare
						</Button>
					</div>

					{activeServerCFDomains.length > 0 && (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
							{activeServerCFDomains.map((cf) => {
								return (
									<div
										key={cf.id}
										className="flex items-center justify-between p-3 rounded-lg border bg-card/80 text-xs shadow-xs"
									>
										<div className="space-y-1 min-w-0 pr-2">
											<div className="font-semibold text-foreground truncate flex items-center gap-1.5">
												<Globe className="h-3.5 w-3.5 text-primary shrink-0" />
												<span className="truncate" title={cf.name}>{cf.name}</span>
											</div>
											<div className="text-[11px] text-muted-foreground flex items-center gap-2">
												<span className="px-1.5 py-0.5 rounded bg-muted/60 font-mono text-[10px]">
													{cf.type}
												</span>
												<span className="truncate">{cf.zoneName}</span>
												{cf.proxied ? (
													<span className="text-amber-500 font-medium flex items-center gap-0.5">
														<Cloud className="h-3 w-3" /> Proxied
													</span>
												) : (
													<span className="text-blue-400 font-medium flex items-center gap-0.5">
														<Radio className="h-3 w-3" /> DNS Only
													</span>
												)}
											</div>
										</div>

										<div className="shrink-0">
											{cf.isMonitored ? (
												<span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
													<CheckCircle2 className="h-3 w-3" />
													Monitored
												</span>
											) : (
												<Button
													size="sm"
													variant="outline"
													className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
													disabled={addingMonitor === cf.id}
													onClick={() => handleAddCloudflareRecordToMonitor(cf, activeServer.id)}
												>
													{addingMonitor === cf.id ? (
														<RefreshCw className="h-3 w-3 animate-spin" />
													) : (
														<Plus className="h-3 w-3" />
													)}
													Monitor
												</Button>
											)}
										</div>
									</div>
								)
							})}
						</div>
					)}
				</div>
			)}

			<Tabs defaultValue="endpoints" className="w-full">
				<TabsList className="grid w-full max-w-md grid-cols-2">
					<TabsTrigger value="endpoints">HTTP &amp; SSL Monitors</TabsTrigger>
					<TabsTrigger value="dns">Cloudflare DNS</TabsTrigger>
				</TabsList>

				<TabsContent value="endpoints" className="space-y-6 mt-6">
					{/* Stats Cards */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div
							className={`p-4 rounded-xl border bg-card/60 backdrop-blur cursor-pointer transition ${
								filter === "all" ? "ring-2 ring-primary" : "hover:border-primary/50"
							}`}
							onClick={() => setFilter("all")}
						>
							<div className="text-xs font-medium text-muted-foreground">TOTAL MONITORS</div>
							<div className="text-2xl font-bold mt-1">{filteredDomains.length}</div>
						</div>
						<div
							className={`p-4 rounded-xl border bg-card/60 backdrop-blur cursor-pointer transition ${
								filter === "up" ? "ring-2 ring-green-500" : "hover:border-green-500/50"
							}`}
							onClick={() => setFilter("up")}
						>
							<div className="text-xs font-medium text-green-500 flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
								HEALTHY (ONLINE)
							</div>
							<div className="text-2xl font-bold mt-1 text-green-500">{countUp}</div>
						</div>
						<div
							className={`p-4 rounded-xl border bg-card/60 backdrop-blur cursor-pointer transition ${
								filter === "degraded" ? "ring-2 ring-amber-500" : "hover:border-amber-500/50"
							}`}
							onClick={() => setFilter("degraded")}
						>
							<div className="text-xs font-medium text-amber-500 flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-amber-500" />
								SSL WARNING
							</div>
							<div className="text-2xl font-bold mt-1 text-amber-500">{countDegraded}</div>
						</div>
						<div
							className={`p-4 rounded-xl border bg-card/60 backdrop-blur cursor-pointer transition ${
								filter === "down" ? "ring-2 ring-red-500" : "hover:border-red-500/50"
							}`}
							onClick={() => setFilter("down")}
						>
							<div className="text-xs font-medium text-red-500 flex items-center gap-1.5">
								<span className="h-2 w-2 rounded-full bg-red-500" />
								DOWN / OFFLINE
							</div>
							<div className="text-2xl font-bold mt-1 text-red-500">{countDown}</div>
						</div>
					</div>

					{/* Search & Actions Bar */}
					<div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
						<div className="relative w-full sm:w-80">
							<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search domains or server..."
								className="pl-9 h-9"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>

						<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
							<Button variant="outline" size="sm" onClick={fetchDomains} disabled={loading}>
								<RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
								Check All
							</Button>
						</div>
					</div>

					{/* Domains Table */}
					{loading && domains.length === 0 ? (
						<div className="p-12 text-center text-muted-foreground">Loading domain monitors...</div>
					) : filteredDomains.length === 0 ? (
						<div className="p-12 text-center border rounded-xl bg-card/40 space-y-3">
							<Globe className="h-10 w-10 text-muted-foreground/50 mx-auto" />
							<div className="text-base font-medium">No Domain Monitors Found</div>
							<p className="text-xs text-muted-foreground max-w-sm mx-auto">
								{selectedServerId !== "all"
									? `No active monitors found for server ${activeServer?.name || ""}. Click "+ Monitor" above to start monitoring domains discovered in Cloudflare.`
									: "Add your first domain or connect Cloudflare to automatically import domains."}
							</p>
							<Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
								<Plus className="h-4 w-4" /> Add Domain
							</Button>
						</div>
					) : (
						<div className="rounded-xl border bg-card/60 backdrop-blur overflow-hidden">
							<div className="overflow-x-auto">
								<table className="w-full text-sm text-left">
									<thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
										<tr>
											<th className="px-4 py-3">Domain / URL</th>
											<th className="px-4 py-3">Server / Target</th>
											<th className="px-4 py-3">Status</th>
											<th className="px-4 py-3">Latency</th>
											<th className="px-4 py-3">SSL Certificate</th>
											<th className="px-4 py-3">Routing</th>
											<th className="px-4 py-3 text-right">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{filteredDomains.map((d) => (
											<tr key={d.id} className="hover:bg-muted/30 transition">
												<td className="px-4 py-3">
													<div className="font-medium text-foreground flex items-center gap-2">
														<span>{d.name}</span>
														<a
															href={d.url}
															target="_blank"
															rel="noreferrer"
															className="text-muted-foreground hover:text-primary transition"
														>
															<ExternalLink className="h-3 w-3" />
														</a>
													</div>
													<div className="text-xs text-muted-foreground font-mono truncate max-w-xs">
														{d.url}
													</div>
												</td>
												<td className="px-4 py-3">
													{d.serverName ? (
														<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-muted font-medium">
															<Server className="h-3 w-3 text-primary" />
															{d.serverName}
														</span>
													) : (
														<span className="text-xs text-muted-foreground">-</span>
													)}
												</td>
												<td className="px-4 py-3">
													<span
														className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
															d.status === "up"
																? "bg-green-500/15 text-green-500 border border-green-500/20"
																: d.status === "degraded"
																? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
																: "bg-red-500/15 text-red-500 border border-red-500/20"
														}`}
													>
														<span
															className={`h-1.5 w-1.5 rounded-full ${
																d.status === "up"
																	? "bg-green-500"
																	: d.status === "degraded"
																	? "bg-amber-500"
																	: "bg-red-500"
															}`}
														/>
														{d.status.toUpperCase()} ({d.statusCode || "ERR"})
													</span>
												</td>
												<td className="px-4 py-3 font-mono text-xs">
													{d.responseTimeMs > 0 ? (
														<span
															className={
																d.responseTimeMs < 200
																	? "text-green-500 font-semibold"
																	: d.responseTimeMs < 500
																	? "text-amber-500"
																	: "text-red-500 font-semibold"
															}
														>
															{d.responseTimeMs} ms
														</span>
													) : (
														<span className="text-muted-foreground">-</span>
													)}
												</td>
												<td className="px-4 py-3">
													{d.ssl.status === "valid" ? (
														<div className="flex items-center gap-1.5 text-xs text-green-500">
															<ShieldCheck className="h-4 w-4 shrink-0" />
															<div>
																<span className="font-medium">{d.ssl.daysRemaining}d left</span>
																<div className="text-[10px] text-muted-foreground">
																	{d.ssl.issuer || "Valid"}
																</div>
															</div>
														</div>
													) : d.ssl.status === "warning" ? (
														<div className="flex items-center gap-1.5 text-xs text-amber-500">
															<ShieldAlert className="h-4 w-4 shrink-0" />
															<div>
																<span className="font-semibold">{d.ssl.daysRemaining}d left</span>
																<div className="text-[10px] text-muted-foreground">
																	Expiring soon
																</div>
															</div>
														</div>
													) : d.ssl.status === "expired" ? (
														<div className="flex items-center gap-1.5 text-xs text-red-500">
															<ShieldX className="h-4 w-4 shrink-0" />
															<span className="font-semibold">Expired</span>
														</div>
													) : (
														<span className="text-xs text-muted-foreground font-mono">No SSL</span>
													)}
												</td>
												<td className="px-4 py-3">
													{d.cloudflare || d.cfProxied ? (
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-500 border border-amber-500/20">
															<Cloud className="h-3 w-3" />
															{d.cfProxied ? "Proxied" : "DNS"}
														</span>
													) : (
														<span className="text-xs text-muted-foreground font-mono">-</span>
													)}
												</td>
												<td className="px-4 py-3 text-right">
													<div className="flex items-center justify-end gap-1.5">
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8"
															title="Check now"
															disabled={checkingId === d.id}
															onClick={() => handleCheckDomain(d.id)}
														>
															<RefreshCw
																className={`h-3.5 w-3.5 ${
																	checkingId === d.id ? "animate-spin text-primary" : ""
																}`}
															/>
														</Button>
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 text-muted-foreground hover:text-red-500"
															title="Delete domain"
															onClick={() => handleDeleteDomain(d.id)}
														>
															<Trash2 className="h-3.5 w-3.5" />
														</Button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</TabsContent>

				<TabsContent value="dns" className="mt-6">
					<CloudflareDNSView onOpenConnect={() => setCfOpen(true)} />
				</TabsContent>
			</Tabs>

			{/* Add Domain Dialog */}
			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Plus className="h-5 w-5 text-primary" />
							Add Domain Monitor
						</DialogTitle>
						<DialogDescription>
							Monitor website status, HTTP latency, and SSL certificate expiration.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label htmlFor="domain-url">Domain URL or Hostname</Label>
							<Input
								id="domain-url"
								placeholder="https://example.com"
								value={newUrl}
								onChange={(e) => setNewUrl(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="domain-name">Display Name (Optional)</Label>
							<Input
								id="domain-name"
								placeholder="e.g. Production Web App"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="domain-server">Associated Server (Optional)</Label>
							<select
								id="domain-server"
								className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
								value={newServerId}
								onChange={(e) => setNewServerId(e.target.value)}
							>
								<option value="">-- None (External) --</option>
								{systems.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name} ({s.host})
									</option>
								))}
							</select>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setAddOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleAddDomain} disabled={!newUrl}>
							Add Monitor
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Cloudflare Connect Modal */}
			<CloudflareDialog
				open={cfOpen}
				onOpenChange={setCfOpen}
				onImportSuccess={() => {
					fetchDomains()
					fetchServerDomains(true)
				}}
			/>
		</div>
	)
}
