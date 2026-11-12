import { useEffect, useState, memo, useMemo } from "react"
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
	Container,
	Play,
	Square,
	RotateCw,
	Trash2,
	FileText,
	Info,
	Network,
	HardDrive,
	Search,
	RefreshCw,
	Plus,
	Copy,
	Check,
	SlidersHorizontal,
	Activity,
	Server,
	Globe,
	Cpu,
	MemoryStick,
	ChevronDown,
	ChevronRight,
	Cloud,
} from "lucide-react"
import ContainersTable from "@/components/containers-table/containers-table"
import { FooterRepoLink } from "@/components/footer-repo-link"
import type { ContainerRecord, SystemRecord } from "@/types"

interface DockerContainer {
	Id: string
	Names: string[]
	Image: string
	Command: string
	Created: number
	State: "running" | "paused" | "exited" | "restarting" | "dead"
	Status: string
	Ports: Array<{
		IP?: string
		PrivatePort: number
		PublicPort?: number
		Type: string
	}>
	NetworkSettings?: {
		Networks?: Record<string, { IPAddress: string }>
	}
	Mounts?: Array<{
		Type: string
		Name?: string
		Source: string
		Destination: string
	}>
}

interface DockerNetwork {
	Id: string
	Name: string
	Driver: string
	Scope: string
	IPAM?: {
		Config?: Array<{
			Subnet?: string
			Gateway?: string
		}>
	}
	Containers?: Record<string, {
		Name: string
		IPv4Address: string
	}>
}

interface DockerVolume {
	Name: string
	Driver: string
	Scope: string
	Mountpoint: string
	CreatedAt?: string
}

// Unified container representation for multi-host view
interface UnifiedContainer {
	id: string
	name: string
	image: string
	systemId: string
	systemName: string
	systemHost: string
	state: "running" | "paused" | "exited"
	statusText: string
	ports: string
	cpu?: number
	memoryMb?: number
	net?: number
	health?: number
	updatable?: boolean
	isLocal: boolean
	rawLocal?: DockerContainer
}

export default memo(() => {
	const systems = useStore($systems)
	const [activeTab, setActiveTab] = useState("containers")
	const [viewMode, setViewMode] = useState<"manage" | "stats">("manage")
	const [selectedServer, setSelectedServer] = useState<string>("all")

	// Local Docker State
	const [localContainers, setLocalContainers] = useState<DockerContainer[]>([])
	const [loadingLocal, setLoadingLocal] = useState(false)
	const [dockerInfo, setDockerInfo] = useState<{ available: boolean; error?: string } | null>(null)

	// Remote Container Records (from PocketBase agent telemetry)
	const [agentContainers, setAgentContainers] = useState<ContainerRecord[]>([])
	const [loadingAgent, setLoadingAgent] = useState(false)

	// Filter & Search State
	const [containerSearch, setContainerSearch] = useState("")
	const [containerFilter, setContainerFilter] = useState<"all" | "running" | "paused" | "exited">("all")
	const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

	// Collapsible host sections in "all" view
	const [collapsedHosts, setCollapsedHosts] = useState<Record<string, boolean>>({})

	// Networks State (Local Docker)
	const [networks, setNetworks] = useState<DockerNetwork[]>([])
	const [loadingNetworks, setLoadingNetworks] = useState(false)
	const [networkSearch, setNetworkSearch] = useState("")
	const [newNetworkName, setNewNetworkName] = useState("")
	const [newNetworkDriver, setNewNetworkDriver] = useState("bridge")
	const [networkModalOpen, setNetworkModalOpen] = useState(false)
	const [networkToDelete, setNetworkToDelete] = useState<DockerNetwork | null>(null)

	// Volumes State (Local Docker)
	const [volumes, setVolumes] = useState<DockerVolume[]>([])
	const [loadingVolumes, setLoadingVolumes] = useState(false)
	const [volumeSearch, setVolumeSearch] = useState("")
	const [newVolumeName, setNewVolumeName] = useState("")
	const [newVolumeDriver, setNewVolumeDriver] = useState("local")
	const [volumeModalOpen, setVolumeModalOpen] = useState(false)
	const [volumeToDelete, setVolumeToDelete] = useState<DockerVolume | null>(null)

	// Cloudflare domains per server count
	const [cfServerCounts, setCfServerCounts] = useState<Record<string, number>>({})

	// Logs Modal
	const [logsOpen, setLogsOpen] = useState(false)
	const [selectedTarget, setSelectedTarget] = useState<{ id: string; name: string; systemId: string; isLocal: boolean } | null>(null)
	const [logsContent, setLogsContent] = useState("")
	const [loadingLogs, setLoadingLogs] = useState(false)
	const [logsCopied, setLogsCopied] = useState(false)

	// Inspect Modal
	const [inspectOpen, setInspectOpen] = useState(false)
	const [inspectData, setInspectData] = useState<any>(null)
	const [loadingInspect, setLoadingInspect] = useState(false)

	// Delete Local Container Modal
	const [containerToDelete, setContainerToDelete] = useState<DockerContainer | null>(null)

	useEffect(() => {
		document.title = "Containers & Docker Management / DockMon"
		fetchLocalContainers()
		fetchLocalDockerStatus()
		fetchAgentContainers()
		fetchCloudflareServerCounts()
	}, [])

	const fetchLocalDockerStatus = async () => {
		try {
			const res = await pb.send<any>("/api/dockmon/docker/status", {})
			setDockerInfo(res)
		} catch (err: any) {
			setDockerInfo({ available: false, error: err.message })
		}
	}

	const fetchLocalContainers = async () => {
		setLoadingLocal(true)
		try {
			const res = await pb.send<DockerContainer[]>("/api/dockmon/docker/containers", {})
			setLocalContainers(res || [])
		} catch (err) {
			console.error("Failed to load local containers", err)
		} finally {
			setLoadingLocal(false)
		}
	}

	const fetchAgentContainers = async () => {
		setLoadingAgent(true)
		try {
			const records = await pb.collection<ContainerRecord>("containers").getFullList({
				sort: "name",
			})
			setAgentContainers(records || [])
		} catch (err) {
			console.error("Failed to load agent containers", err)
		} finally {
			setLoadingAgent(false)
		}
	}

	const fetchCloudflareServerCounts = async () => {
		try {
			const res = await pb.send<{
				byServer: Record<string, { count: number }>
			}>("/api/dockmon/cloudflare/records-by-server", {})
			if (res?.byServer) {
				const counts: Record<string, number> = {}
				for (const [sId, group] of Object.entries(res.byServer)) {
					counts[sId] = group.count || 0
				}
				setCfServerCounts(counts)
			}
		} catch (err) {
			console.error("Failed to fetch cloudflare records by server", err)
		}
	}

	const fetchNetworks = async () => {
		setLoadingNetworks(true)
		try {
			const res = await pb.send<DockerNetwork[]>("/api/dockmon/docker/networks", {})
			setNetworks(res || [])
		} catch (err) {
			console.error("Failed to load networks", err)
		} finally {
			setLoadingNetworks(false)
		}
	}

	const fetchVolumes = async () => {
		setLoadingVolumes(true)
		try {
			const res = await pb.send<DockerVolume[]>("/api/dockmon/docker/volumes", {})
			setVolumes(res || [])
		} catch (err) {
			console.error("Failed to load volumes", err)
		} finally {
			setLoadingVolumes(false)
		}
	}

	const refreshAll = () => {
		fetchLocalContainers()
		fetchAgentContainers()
		if (activeTab === "networks") fetchNetworks()
		if (activeTab === "volumes") fetchVolumes()
	}

	// Local container action
	const handleLocalContainerAction = async (id: string, action: string) => {
		setActionLoading((prev) => ({ ...prev, [id]: true }))
		try {
			await pb.send(`/api/dockmon/docker/containers/${id}/action`, {
				method: "POST",
				body: { action },
			})
			fetchLocalContainers()
		} catch (err: any) {
			alert(`Action failed: ${err.message || err}`)
		} finally {
			setActionLoading((prev) => ({ ...prev, [id]: false }))
		}
	}

	// Open Logs Dialog (Unified: Local or Remote Agent)
	const openLogs = async (target: { id: string; name: string; systemId: string; isLocal: boolean }) => {
		setSelectedTarget(target)
		setLogsOpen(true)
		setLoadingLogs(true)
		setLogsCopied(false)
		setLogsContent("")

		try {
			if (target.isLocal) {
				const res = await pb.send<{ logs: string }>(`/api/dockmon/docker/containers/${target.id}/logs?tail=300`, {})
				setLogsContent(res.logs || "(No log output recorded)")
			} else {
				const res = await pb.send<{ logs: string }>(
					`/api/beszel/containers/logs?system=${encodeURIComponent(target.systemId)}&container=${encodeURIComponent(target.id)}`,
					{}
				)
				setLogsContent(res.logs || "(No log output recorded from agent)")
			}
		} catch (err: any) {
			setLogsContent(`Error retrieving logs: ${err.message || err}`)
		} finally {
			setLoadingLogs(false)
		}
	}

	// Open Inspect Dialog (Unified: Local or Remote Agent)
	const openInspect = async (target: { id: string; name: string; systemId: string; isLocal: boolean }) => {
		setSelectedTarget(target)
		setInspectOpen(true)
		setLoadingInspect(true)
		setInspectData(null)

		try {
			if (target.isLocal) {
				const res = await pb.send<any>(`/api/dockmon/docker/containers/${target.id}/inspect`, {})
				setInspectData(res)
			} else {
				const res = await pb.send<{ info: string }>(
					`/api/beszel/containers/info?system=${encodeURIComponent(target.systemId)}&container=${encodeURIComponent(target.id)}`,
					{}
				)
				try {
					setInspectData(JSON.parse(res.info))
				} catch {
					setInspectData(res.info)
				}
			}
		} catch (err: any) {
			setInspectData({ error: err.message || "Failed to inspect container" })
		} finally {
			setLoadingInspect(false)
		}
	}

	// Network & Volume handlers for local docker
	const handleCreateNetwork = async () => {
		if (!newNetworkName) return
		try {
			await pb.send("/api/dockmon/docker/networks", {
				method: "POST",
				body: { name: newNetworkName, driver: newNetworkDriver },
			})
			setNetworkModalOpen(false)
			setNewNetworkName("")
			fetchNetworks()
		} catch (err: any) {
			alert(`Failed to create network: ${err.message}`)
		}
	}

	const handleDeleteNetwork = async () => {
		if (!networkToDelete) return
		try {
			await pb.send(`/api/dockmon/docker/networks/${networkToDelete.Id}`, {
				method: "DELETE",
			})
			setNetworkToDelete(null)
			fetchNetworks()
		} catch (err: any) {
			alert(`Failed to remove network: ${err.message}`)
		}
	}

	const handlePruneNetworks = async () => {
		if (!confirm("Are you sure you want to prune all unused Docker networks?")) return
		try {
			await pb.send("/api/dockmon/docker/networks/prune", { method: "POST" })
			fetchNetworks()
		} catch (err: any) {
			alert(`Prune failed: ${err.message}`)
		}
	}

	const handleCreateVolume = async () => {
		if (!newVolumeName) return
		try {
			await pb.send("/api/dockmon/docker/volumes", {
				method: "POST",
				body: { name: newVolumeName, driver: newVolumeDriver },
			})
			setVolumeModalOpen(false)
			setNewVolumeName("")
			fetchVolumes()
		} catch (err: any) {
			alert(`Failed to create volume: ${err.message}`)
		}
	}

	const handleDeleteVolume = async () => {
		if (!volumeToDelete) return
		try {
			await pb.send(`/api/dockmon/docker/volumes/${encodeURIComponent(volumeToDelete.Name)}`, {
				method: "DELETE",
			})
			setVolumeToDelete(null)
			fetchVolumes()
		} catch (err: any) {
			alert(`Failed to remove volume: ${err.message}`)
		}
	}

	const handlePruneVolumes = async () => {
		if (!confirm("Are you sure you want to prune all unused Docker storage volumes?")) return
		try {
			await pb.send("/api/dockmon/docker/volumes/prune", { method: "POST" })
			fetchVolumes()
		} catch (err: any) {
			alert(`Prune failed: ${err.message}`)
		}
	}

	// Convert Local Containers to Unified
	const unifiedLocal: UnifiedContainer[] = useMemo(() => {
		if (!dockerInfo?.available) return []
		return localContainers.map((c) => {
			const name = (c.Names[0] || "").replace(/^\//, "")
			const isRunning = c.State === "running"
			const isPaused = c.State === "paused"
			const state = isRunning ? "running" : isPaused ? "paused" : "exited"

			const portStr = (c.Ports || [])
				.map((p) => (p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}/${p.Type}`))
				.join(", ")

			return {
				id: c.Id,
				name,
				image: c.Image,
				systemId: "local",
				systemName: "Local Docker Engine",
				systemHost: "unix:///var/run/docker.sock",
				state,
				statusText: c.Status || (isRunning ? "Running" : "Stopped"),
				ports: portStr,
				isLocal: true,
				rawLocal: c,
			}
		})
	}, [localContainers, dockerInfo])

	// Convert Remote Agent Containers to Unified
	const unifiedAgent: UnifiedContainer[] = useMemo(() => {
		const sysMap = new Map<string, SystemRecord>()
		for (const s of systems) {
			sysMap.set(s.id, s)
		}

		return agentContainers.map((rec) => {
			const sys = sysMap.get(rec.system)
			const statusLower = (rec.status || "").toLowerCase()
			const isRunning = statusLower.startsWith("up")
			const isPaused = statusLower.includes("paused")
			const state: "running" | "paused" | "exited" = isPaused ? "paused" : isRunning ? "running" : "exited"

			return {
				id: rec.id,
				name: rec.name,
				image: rec.image,
				systemId: rec.system,
				systemName: sys?.name || rec.system,
				systemHost: sys?.host || "",
				state,
				statusText: rec.status || (isRunning ? "Up" : "Exited"),
				ports: rec.ports || "",
				cpu: rec.cpu,
				memoryMb: rec.memory,
				net: rec.net,
				health: rec.health,
				updatable: rec.updatable,
				isLocal: false,
			}
		})
	}, [agentContainers, systems])

	// All Unified Containers
	const allUnified = useMemo(() => {
		return [...unifiedAgent, ...unifiedLocal]
	}, [unifiedAgent, unifiedLocal])

	// Filtered by Selected Server
	const serverFiltered = useMemo(() => {
		if (selectedServer === "all") return allUnified
		if (selectedServer === "local") return unifiedLocal
		return unifiedAgent.filter((c) => c.systemId === selectedServer)
	}, [allUnified, unifiedLocal, unifiedAgent, selectedServer])

	// Filtered by Search & Status
	const displayedContainers = useMemo(() => {
		return serverFiltered.filter((c) => {
			const matchSearch =
				c.name.toLowerCase().includes(containerSearch.toLowerCase()) ||
				c.image.toLowerCase().includes(containerSearch.toLowerCase()) ||
				c.id.toLowerCase().includes(containerSearch.toLowerCase()) ||
				c.systemName.toLowerCase().includes(containerSearch.toLowerCase())
			const matchStatus = containerFilter === "all" || c.state === containerFilter
			return matchSearch && matchStatus
		})
	}, [serverFiltered, containerSearch, containerFilter])

	// Counts
	const countRunning = serverFiltered.filter((c) => c.state === "running").length
	const countPaused = serverFiltered.filter((c) => c.state === "paused").length
	const countExited = serverFiltered.filter((c) => c.state === "exited").length

	// Active server object
	const activeSystem = systems.find((s) => s.id === selectedServer)

	// Group containers by host for "all" view
	const containersByHost = useMemo(() => {
		const groups: Record<string, { systemId: string; systemName: string; systemHost: string; isLocal: boolean; containers: UnifiedContainer[] }> = {}

		for (const c of displayedContainers) {
			const key = c.systemId
			if (!groups[key]) {
				groups[key] = {
					systemId: c.systemId,
					systemName: c.systemName,
					systemHost: c.systemHost,
					isLocal: c.isLocal,
					containers: [],
				}
			}
			groups[key].containers.push(c)
		}
		return Object.values(groups)
	}, [displayedContainers])

	const toggleHostCollapse = (key: string) => {
		setCollapsedHosts((prev) => ({ ...prev, [key]: !prev[key] }))
	}

	return (
		<div className="space-y-6 pb-12">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
						<Container className="h-6 w-6 text-primary" />
						Docker Management &amp; Containers
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Multi-server container control, per-host monitoring, live resource stats, and Docker inspection.
					</p>
				</div>

				<div className="flex items-center gap-2">
					{activeTab === "containers" && (
						<div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/60">
							<Button
								variant={viewMode === "manage" ? "default" : "ghost"}
								size="sm"
								className="h-7 text-xs gap-1.5"
								onClick={() => setViewMode("manage")}
							>
								<SlidersHorizontal className="h-3.5 w-3.5" />
								Per-Host Control
							</Button>
							<Button
								variant={viewMode === "stats" ? "default" : "ghost"}
								size="sm"
								className="h-7 text-xs gap-1.5"
								onClick={() => setViewMode("stats")}
							>
								<Activity className="h-3.5 w-3.5" />
								Live Stats Table
							</Button>
						</div>
					)}
					<Button variant="outline" size="sm" onClick={refreshAll}>
						<RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingAgent || loadingLocal ? "animate-spin" : ""}`} />
						Refresh
					</Button>
				</div>
			</div>

			{/* Server Selector Menu (เมนู Server ด้านบน) */}
			<div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border bg-card/60 backdrop-blur">
				<div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 px-2">
					<Server className="h-3.5 w-3.5 text-primary" />
					<span>Select Host / Server:</span>
				</div>

				<Button
					variant={selectedServer === "all" ? "default" : "outline"}
					size="sm"
					className="h-7 text-xs gap-1.5"
					onClick={() => setSelectedServer("all")}
				>
					<Globe className="h-3 w-3" />
					All Hosts ({allUnified.length})
				</Button>

				{/* Remote Systems from Beszel/DockMon */}
				{systems.map((s) => {
					const count = unifiedAgent.filter((c) => c.systemId === s.id).length
					const isSelected = selectedServer === s.id
					const cfCount = cfServerCounts[s.id] || 0

					return (
						<Button
							key={s.id}
							variant={isSelected ? "default" : "outline"}
							size="sm"
							className={`h-7 text-xs gap-1.5 ${isSelected ? "" : "border-border/70"}`}
							onClick={() => setSelectedServer(s.id)}
						>
							<span
								className={`h-2 w-2 rounded-full ${
									s.status === "up" ? "bg-emerald-500 animate-pulse" : "bg-red-500"
								}`}
							/>
							<span className="font-semibold">{s.name}</span>
							<span className="text-[10px] text-muted-foreground font-mono">({s.host})</span>
							<span
								className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
									isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
								}`}
							>
								{count}
							</span>
							{cfCount > 0 && (
								<span
									className={`text-[9px] px-1 py-0.2 rounded font-mono ${
										isSelected ? "bg-amber-400 text-black font-bold" : "bg-amber-500/15 text-amber-500 border border-amber-500/20"
									}`}
									title={`${cfCount} domain(s) in Cloudflare point to this server`}
								>
									{cfCount} CF
								</span>
							)}
						</Button>
					)
				})}

				{/* Local Docker Engine */}
				<Button
					variant={selectedServer === "local" ? "default" : "outline"}
					size="sm"
					className={`h-7 text-xs gap-1.5 ${selectedServer === "local" ? "" : "border-border/70"}`}
					onClick={() => setSelectedServer("local")}
				>
					<span
						className={`h-2 w-2 rounded-full ${
							dockerInfo?.available ? "bg-emerald-500" : "bg-muted-foreground"
						}`}
					/>
					<span>Local Docker</span>
					<span
						className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
							selectedServer === "local" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
						}`}
					>
						{unifiedLocal.length}
					</span>
				</Button>
			</div>

			{/* Active Server Info Header (when a specific remote system is selected) */}
			{activeSystem && (
				<div className="rounded-xl border bg-card/70 p-4 space-y-3">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
								<Server className="h-5 w-5" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<h3 className="font-bold text-base text-foreground">{activeSystem.name}</h3>
									<span
										className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
											activeSystem.status === "up"
												? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20"
												: "bg-red-500/15 text-red-500 border border-red-500/20"
										}`}
									>
										<span className={`h-1.5 w-1.5 rounded-full ${activeSystem.status === "up" ? "bg-emerald-500" : "bg-red-500"}`} />
										{activeSystem.status.toUpperCase()}
									</span>
									<span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
										{activeSystem.host}:{activeSystem.port}
									</span>
								</div>
								<div className="text-xs text-muted-foreground mt-0.5">
									Agent {activeSystem.info?.v ? `v${activeSystem.info.v}` : "connected"} • Kernel {activeSystem.info?.k || "Linux"} • {serverFiltered.length} container(s) reported
								</div>
							</div>
						</div>

						{/* System Live Resources */}
						{activeSystem.info && (
							<div className="flex items-center gap-4 text-xs font-mono self-start sm:self-auto">
								<div className="flex items-center gap-1.5">
									<Cpu className="h-3.5 w-3.5 text-primary" />
									<span className="text-muted-foreground">CPU:</span>
									<span className="font-semibold text-foreground">{activeSystem.info.cpu ?? 0}%</span>
								</div>
								<div className="flex items-center gap-1.5">
									<MemoryStick className="h-3.5 w-3.5 text-primary" />
									<span className="text-muted-foreground">RAM:</span>
									<span className="font-semibold text-foreground">{activeSystem.info.mp ?? 0}%</span>
								</div>
								<div className="flex items-center gap-1.5">
									<HardDrive className="h-3.5 w-3.5 text-primary" />
									<span className="text-muted-foreground">Disk:</span>
									<span className="font-semibold text-foreground">{activeSystem.info.dp ?? 0}%</span>
								</div>
								{cfServerCounts[activeSystem.id] > 0 && (
									<div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
										<Cloud className="h-3.5 w-3.5" />
										<span>{cfServerCounts[activeSystem.id]} Cloudflare Domain(s)</span>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Local Docker Status Warning if local selected and not available */}
			{selectedServer === "local" && dockerInfo && !dockerInfo.available && (
				<div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
					<div>
						<div className="font-semibold">Local Docker Daemon Not Accessible</div>
						<div className="text-xs mt-0.5">
							{dockerInfo.error || "Make sure /var/run/docker.sock is mounted into the container."}
						</div>
					</div>
				</div>
			)}

			<Tabs
				value={activeTab}
				onValueChange={(val) => {
					setActiveTab(val)
					if (val === "networks" && networks.length === 0) fetchNetworks()
					if (val === "volumes" && volumes.length === 0) fetchVolumes()
				}}
				className="w-full"
			>
				<TabsList className="grid w-full max-w-md grid-cols-3">
					<TabsTrigger value="containers" className="gap-1.5">
						<Container className="h-4 w-4" />
						Containers ({serverFiltered.length})
					</TabsTrigger>
					<TabsTrigger value="networks" className="gap-1.5" disabled={selectedServer !== "local" && selectedServer !== "all"}>
						<Network className="h-4 w-4" />
						Networks
					</TabsTrigger>
					<TabsTrigger value="volumes" className="gap-1.5" disabled={selectedServer !== "local" && selectedServer !== "all"}>
						<HardDrive className="h-4 w-4" />
						Volumes
					</TabsTrigger>
				</TabsList>

				{/* ---------------- CONTAINERS TAB ---------------- */}
				<TabsContent value="containers" className="space-y-6 mt-6">
					{viewMode === "stats" ? (
						<ContainersTable systemId={selectedServer === "all" || selectedServer === "local" ? undefined : selectedServer} />
					) : (
						<>
							{/* Stats Cards */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
								<div
									className={`p-3.5 rounded-xl border bg-card cursor-pointer transition ${
										containerFilter === "all" ? "ring-2 ring-primary" : "hover:border-primary/50"
									}`}
									onClick={() => setContainerFilter("all")}
								>
									<div className="text-xs text-muted-foreground font-medium">TOTAL CONTAINERS</div>
									<div className="text-2xl font-bold mt-1">{serverFiltered.length}</div>
								</div>
								<div
									className={`p-3.5 rounded-xl border bg-card cursor-pointer transition ${
										containerFilter === "running" ? "ring-2 ring-emerald-500" : "hover:border-emerald-500/50"
									}`}
									onClick={() => setContainerFilter("running")}
								>
									<div className="text-xs text-emerald-500 font-medium flex items-center gap-1.5">
										<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
										RUNNING
									</div>
									<div className="text-2xl font-bold mt-1 text-emerald-500">{countRunning}</div>
								</div>
								<div
									className={`p-3.5 rounded-xl border bg-card cursor-pointer transition ${
										containerFilter === "paused" ? "ring-2 ring-amber-500" : "hover:border-amber-500/50"
									}`}
									onClick={() => setContainerFilter("paused")}
								>
									<div className="text-xs text-amber-500 font-medium flex items-center gap-1.5">
										<span className="h-2 w-2 rounded-full bg-amber-500" />
										PAUSED
									</div>
									<div className="text-2xl font-bold mt-1 text-amber-500">{countPaused}</div>
								</div>
								<div
									className={`p-3.5 rounded-xl border bg-card cursor-pointer transition ${
										containerFilter === "exited" ? "ring-2 ring-destructive" : "hover:border-destructive/50"
									}`}
									onClick={() => setContainerFilter("exited")}
								>
									<div className="text-xs text-destructive font-medium flex items-center gap-1.5">
										<span className="h-2 w-2 rounded-full bg-destructive" />
										STOPPED / EXITED
									</div>
									<div className="text-2xl font-bold mt-1 text-destructive">{countExited}</div>
								</div>
							</div>

							{/* Search Bar */}
							<div className="flex items-center justify-between gap-3">
								<div className="relative flex-1 max-w-sm">
									<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search containers by name, image, host..."
										value={containerSearch}
										onChange={(e) => setContainerSearch(e.target.value)}
										className="pl-9 h-9"
									/>
								</div>
								<div className="text-xs text-muted-foreground">
									Showing {displayedContainers.length} of {serverFiltered.length} containers
								</div>
							</div>

							{/* Container List Display */}
							{loadingAgent && displayedContainers.length === 0 ? (
								<div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2 border rounded-xl bg-card">
									<RefreshCw className="h-6 w-6 animate-spin text-primary" />
									<p className="text-sm">Fetching containers across hosts...</p>
								</div>
							) : displayedContainers.length === 0 ? (
								<div className="p-12 text-center text-muted-foreground border rounded-xl bg-card">
									<Container className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
									<p className="text-sm font-medium">No containers found</p>
									<p className="text-xs text-muted-foreground mt-1">
										{selectedServer === "all"
											? "No containers reported from any connected servers."
											: "No containers match the current filter on this host."}
									</p>
								</div>
							) : selectedServer === "all" ? (
								// Grouped By Host
								<div className="space-y-6">
									{containersByHost.map((group) => {
										const isCollapsed = !!collapsedHosts[group.systemId]
										return (
											<div key={group.systemId} className="rounded-xl border border-border/60 bg-card overflow-hidden">
												{/* Host Group Header */}
												<div
													className="flex items-center justify-between p-3.5 bg-muted/40 border-b border-border/40 cursor-pointer hover:bg-muted/60 transition"
													onClick={() => toggleHostCollapse(group.systemId)}
												>
													<div className="flex items-center gap-2.5">
														{isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
														<Server className="h-4 w-4 text-primary" />
														<span className="font-bold text-sm text-foreground">{group.systemName}</span>
														{group.systemHost && (
															<span className="text-xs font-mono text-muted-foreground">
																({group.systemHost})
															</span>
														)}
														<span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-semibold">
															{group.containers.length} containers
														</span>
													</div>
													<Button
														variant="ghost"
														size="sm"
														className="h-6 text-xs text-muted-foreground hover:text-foreground"
														onClick={(e) => {
															e.stopPropagation()
															setSelectedServer(group.systemId)
														}}
													>
														Filter this host &rarr;
													</Button>
												</div>

												{/* Host Container Table */}
												{!isCollapsed && (
													<ContainerTableContent
														containers={group.containers}
														actionLoading={actionLoading}
														onAction={handleLocalContainerAction}
														onOpenLogs={openLogs}
														onOpenInspect={openInspect}
														onDeleteLocal={(c) => setContainerToDelete(c)}
													/>
												)}
											</div>
										)
									})}
								</div>
							) : (
								// Single Host View
								<div className="rounded-xl border border-border/60 bg-card overflow-hidden">
									<ContainerTableContent
										containers={displayedContainers}
										actionLoading={actionLoading}
										onAction={handleLocalContainerAction}
										onOpenLogs={openLogs}
										onOpenInspect={openInspect}
										onDeleteLocal={(c) => setContainerToDelete(c)}
									/>
								</div>
							)}
						</>
					)}
				</TabsContent>

				{/* ---------------- NETWORKS TAB (LOCAL DOCKER) ---------------- */}
				<TabsContent value="networks" className="space-y-6 mt-6">
					<div className="flex items-center justify-between gap-4">
						<div className="relative flex-1 max-w-sm">
							<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search networks..."
								value={networkSearch}
								onChange={(e) => setNetworkSearch(e.target.value)}
								className="pl-9 h-9"
							/>
						</div>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handlePruneNetworks}>
								<Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" />
								Prune Unused
							</Button>
							<Button size="sm" onClick={() => setNetworkModalOpen(true)}>
								<Plus className="h-3.5 w-3.5 mr-1" />
								Create Network
							</Button>
						</div>
					</div>

					<div className="rounded-xl border border-border/60 bg-card overflow-hidden">
						{loadingNetworks ? (
							<div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
								<RefreshCw className="h-6 w-6 animate-spin text-primary" />
								<p className="text-sm">Loading Docker networks...</p>
							</div>
						) : networks.length === 0 ? (
							<div className="p-12 text-center text-muted-foreground">
								<Network className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
								<p className="text-sm font-medium">No Docker networks available</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead>
										<tr className="border-b border-border/60 bg-muted/40 text-xs font-medium text-muted-foreground">
											<th className="py-3 px-4">Name</th>
											<th className="py-3 px-4">ID</th>
											<th className="py-3 px-4">Driver</th>
											<th className="py-3 px-4">Scope</th>
											<th className="py-3 px-4">Subnet / Gateway</th>
											<th className="py-3 px-4 text-right">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/40">
										{networks
											.filter((n) => n.Name.toLowerCase().includes(networkSearch.toLowerCase()))
											.map((net) => {
												const isSystem = ["bridge", "host", "none"].includes(net.Name)
												const ipam = net.IPAM?.Config?.[0]
												return (
													<tr key={net.Id} className="hover:bg-muted/20 transition-colors">
														<td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
															<Network className="h-4 w-4 text-primary" />
															{net.Name}
														</td>
														<td className="py-3 px-4 font-mono text-xs text-muted-foreground">
															{net.Id.slice(0, 12)}
														</td>
														<td className="py-3 px-4">
															<span className="px-2 py-0.5 rounded text-xs bg-muted font-mono">{net.Driver}</span>
														</td>
														<td className="py-3 px-4 text-xs text-muted-foreground">{net.Scope}</td>
														<td className="py-3 px-4 font-mono text-xs text-muted-foreground">
															{ipam?.Subnet || "-"} {ipam?.Gateway ? `(${ipam.Gateway})` : ""}
														</td>
														<td className="py-3 px-4 text-right">
															{!isSystem && (
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-7 text-xs text-destructive hover:bg-destructive/10"
																	onClick={() => setNetworkToDelete(net)}
																>
																	<Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
																</Button>
															)}
														</td>
													</tr>
												)
											})}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</TabsContent>

				{/* ---------------- VOLUMES TAB (LOCAL DOCKER) ---------------- */}
				<TabsContent value="volumes" className="space-y-6 mt-6">
					<div className="flex items-center justify-between gap-4">
						<div className="relative flex-1 max-w-sm">
							<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search volumes..."
								value={volumeSearch}
								onChange={(e) => setVolumeSearch(e.target.value)}
								className="pl-9 h-9"
							/>
						</div>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handlePruneVolumes}>
								<Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" />
								Prune Unused
							</Button>
							<Button size="sm" onClick={() => setVolumeModalOpen(true)}>
								<Plus className="h-3.5 w-3.5 mr-1" />
								Create Volume
							</Button>
						</div>
					</div>

					<div className="rounded-xl border border-border/60 bg-card overflow-hidden">
						{loadingVolumes ? (
							<div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
								<RefreshCw className="h-6 w-6 animate-spin text-primary" />
								<p className="text-sm">Loading Docker volumes...</p>
							</div>
						) : volumes.length === 0 ? (
							<div className="p-12 text-center text-muted-foreground">
								<HardDrive className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
								<p className="text-sm font-medium">No storage volumes found</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead>
										<tr className="border-b border-border/60 bg-muted/40 text-xs font-medium text-muted-foreground">
											<th className="py-3 px-4">Volume Name</th>
											<th className="py-3 px-4">Driver</th>
											<th className="py-3 px-4">Mountpoint</th>
											<th className="py-3 px-4">Created</th>
											<th className="py-3 px-4 text-right">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/40">
										{volumes
											.filter((v) => v.Name.toLowerCase().includes(volumeSearch.toLowerCase()))
											.map((vol) => (
												<tr key={vol.Name} className="hover:bg-muted/20 transition-colors">
													<td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
														<HardDrive className="h-4 w-4 text-primary" />
														{vol.Name}
													</td>
													<td className="py-3 px-4">
														<span className="px-2 py-0.5 rounded text-xs bg-muted font-mono">{vol.Driver}</span>
													</td>
													<td className="py-3 px-4 font-mono text-xs text-muted-foreground truncate max-w-sm" title={vol.Mountpoint}>
														{vol.Mountpoint}
													</td>
													<td className="py-3 px-4 text-xs text-muted-foreground">
														{vol.CreatedAt ? new Date(vol.CreatedAt).toLocaleDateString() : "-"}
													</td>
													<td className="py-3 px-4 text-right">
														<Button
															variant="ghost"
															size="sm"
															className="h-7 text-xs text-destructive hover:bg-destructive/10"
															onClick={() => setVolumeToDelete(vol)}
														>
															<Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
														</Button>
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</TabsContent>
			</Tabs>

			{/* Unified Logs Viewer Modal */}
			<Dialog open={logsOpen} onOpenChange={setLogsOpen}>
				<DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
					<DialogHeader>
						<DialogTitle className="flex items-center justify-between text-base">
							<div className="flex items-center gap-2">
								<FileText className="h-4 w-4 text-primary" />
								<span>Live Logs: {selectedTarget?.name}</span>
								<span className="text-xs px-2 py-0.5 rounded bg-muted font-mono text-muted-foreground">
									{selectedTarget?.isLocal ? "Local Docker" : "Agent Stream"}
								</span>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="h-7 text-xs gap-1.5"
								onClick={() => {
									navigator.clipboard.writeText(logsContent)
									setLogsCopied(true)
									setTimeout(() => setLogsCopied(false), 2000)
								}}
							>
								{logsCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
								{logsCopied ? "Copied" : "Copy Logs"}
							</Button>
						</DialogTitle>
						<DialogDescription className="text-xs">
							Showing live logs from container {selectedTarget?.id.slice(0, 12)}.
						</DialogDescription>
					</DialogHeader>

					<div className="flex-1 min-h-[350px] max-h-[550px] overflow-auto bg-black/90 text-zinc-200 p-4 rounded-lg font-mono text-xs leading-relaxed border border-border/40 select-text">
						{loadingLogs ? (
							<div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
								<RefreshCw className="h-5 w-5 animate-spin text-primary" />
								<span>Streaming container logs...</span>
							</div>
						) : (
							<pre className="whitespace-pre-wrap break-all">{logsContent}</pre>
						)}
					</div>

					<DialogFooter className="flex items-center justify-between sm:justify-between">
						<Button
							variant="outline"
							size="sm"
							onClick={() => selectedTarget && openLogs(selectedTarget)}
							disabled={loadingLogs}
						>
							<RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingLogs ? "animate-spin" : ""}`} />
							Reload Logs
						</Button>
						<Button variant="outline" size="sm" onClick={() => setLogsOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Unified Inspect Viewer Modal */}
			<Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
				<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-base">
							<Info className="h-4 w-4 text-primary" />
							<span>Inspect Container: {selectedTarget?.name}</span>
						</DialogTitle>
						<DialogDescription className="text-xs">
							Detailed JSON metadata for container ID {selectedTarget?.id}.
						</DialogDescription>
					</DialogHeader>

					<div className="flex-1 min-h-[350px] max-h-[550px] overflow-auto bg-muted/40 p-4 rounded-lg font-mono text-xs border border-border/40 select-text">
						{loadingInspect ? (
							<div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
								<RefreshCw className="h-5 w-5 animate-spin text-primary" />
								<span>Querying container metadata...</span>
							</div>
						) : (
							<pre className="whitespace-pre-wrap">{JSON.stringify(inspectData, null, 2)}</pre>
						)}
					</div>

					<DialogFooter>
						<Button variant="outline" size="sm" onClick={() => setInspectOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Create Network Dialog */}
			<Dialog open={networkModalOpen} onOpenChange={setNetworkModalOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Create Docker Network</DialogTitle>
						<DialogDescription>Create a virtual network on the local Docker daemon.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-1.5">
							<Label className="text-xs">Network Name</Label>
							<Input
								placeholder="e.g. app-network"
								value={newNetworkName}
								onChange={(e) => setNewNetworkName(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Driver</Label>
							<select
								className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
								value={newNetworkDriver}
								onChange={(e) => setNewNetworkDriver(e.target.value)}
							>
								<option value="bridge">bridge (default)</option>
								<option value="host">host</option>
								<option value="overlay">overlay (swarm)</option>
								<option value="macvlan">macvlan</option>
							</select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setNetworkModalOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreateNetwork} disabled={!newNetworkName}>
							Create Network
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Create Volume Dialog */}
			<Dialog open={volumeModalOpen} onOpenChange={setVolumeModalOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Create Persistent Volume</DialogTitle>
						<DialogDescription>Create a managed storage volume for containers.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-1.5">
							<Label className="text-xs">Volume Name</Label>
							<Input
								placeholder="e.g. postgres_data"
								value={newVolumeName}
								onChange={(e) => setNewVolumeName(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Driver</Label>
							<select
								className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
								value={newVolumeDriver}
								onChange={(e) => setNewVolumeDriver(e.target.value)}
							>
								<option value="local">local (default)</option>
							</select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setVolumeModalOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreateVolume} disabled={!newVolumeName}>
							Create Volume
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Network Dialog */}
			<Dialog open={Boolean(networkToDelete)} onOpenChange={() => setNetworkToDelete(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Delete Network</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete network <span className="font-semibold text-foreground">{networkToDelete?.Name}</span>?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setNetworkToDelete(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteNetwork}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Volume Dialog */}
			<Dialog open={Boolean(volumeToDelete)} onOpenChange={() => setVolumeToDelete(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Delete Volume</DialogTitle>
						<DialogDescription>
							Are you sure you want to permanently delete volume <span className="font-semibold text-foreground">{volumeToDelete?.Name}</span>?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setVolumeToDelete(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteVolume}>
							Delete Volume
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Local Container Dialog */}
			<Dialog open={Boolean(containerToDelete)} onOpenChange={() => setContainerToDelete(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Remove Container</DialogTitle>
						<DialogDescription>
							Are you sure you want to force remove container <span className="font-semibold text-foreground">{(containerToDelete?.Names[0] || "").replace(/^\//, "")}</span>?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setContainerToDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={async () => {
								if (!containerToDelete) return
								await handleLocalContainerAction(containerToDelete.Id, "remove")
								setContainerToDelete(null)
							}}
						>
							Force Remove
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<FooterRepoLink />
		</div>
	)
})

// Sub-component for Container Table Rows
function ContainerTableContent({
	containers,
	actionLoading,
	onAction,
	onOpenLogs,
	onOpenInspect,
	onDeleteLocal,
}: {
	containers: UnifiedContainer[]
	actionLoading: Record<string, boolean>
	onAction: (id: string, action: string) => Promise<void>
	onOpenLogs: (target: { id: string; name: string; systemId: string; isLocal: boolean }) => void
	onOpenInspect: (target: { id: string; name: string; systemId: string; isLocal: boolean }) => void
	onDeleteLocal: (c: DockerContainer) => void
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-sm">
				<thead>
					<tr className="border-b border-border/60 bg-muted/40 text-xs font-medium text-muted-foreground">
						<th className="py-3 px-4">State</th>
						<th className="py-3 px-4">Container Name / ID</th>
						<th className="py-3 px-4">Host</th>
						<th className="py-3 px-4">Image</th>
						<th className="py-3 px-4">Live Usage</th>
						<th className="py-3 px-4">Ports</th>
						<th className="py-3 px-4">Status / Uptime</th>
						<th className="py-3 px-4 text-right">Actions &amp; Logs</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border/40">
					{containers.map((c) => {
						const isRunning = c.state === "running"
						const isPaused = c.state === "paused"
						const isLoading = actionLoading[c.id]
						const shortId = c.id.slice(0, 12)

						return (
							<tr key={`${c.systemId}-${c.id}`} className="hover:bg-muted/20 transition-colors">
								{/* State */}
								<td className="py-3 px-4">
									{isRunning ? (
										<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-500">
											<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
											Running
										</span>
									) : isPaused ? (
										<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-500">
											<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
											Paused
										</span>
									) : (
										<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
											<span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
											Stopped
										</span>
									)}
								</td>

								{/* Name */}
								<td className="py-3 px-4">
									<div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
										{c.name}
										{c.updatable && (
											<span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 font-semibold border border-amber-500/25">
												Update Available
											</span>
										)}
									</div>
									<div className="font-mono text-[11px] text-muted-foreground mt-0.5">
										{shortId}
									</div>
								</td>

								{/* Host */}
								<td className="py-3 px-4">
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted/80 font-medium">
										<Server className="h-3 w-3 text-primary shrink-0" />
										<span className="truncate max-w-[120px]">{c.systemName}</span>
									</span>
								</td>

								{/* Image */}
								<td className="py-3 px-4 font-mono text-xs text-muted-foreground max-w-[180px] truncate" title={c.image}>
									{c.image}
								</td>

								{/* Live Resource Usage */}
								<td className="py-3 px-4 text-xs font-mono">
									{c.cpu !== undefined || c.memoryMb !== undefined ? (
										<div className="space-y-0.5">
											<div className="text-foreground font-semibold flex items-center gap-1">
												<Cpu className="h-3 w-3 text-primary" />
												<span>{c.cpu?.toFixed(1) ?? "0.0"}%</span>
											</div>
											<div className="text-muted-foreground flex items-center gap-1">
												<MemoryStick className="h-3 w-3 text-primary" />
												<span>{c.memoryMb?.toFixed(1) ?? "0"} MB</span>
											</div>
										</div>
									) : (
										<span className="text-muted-foreground">-</span>
									)}
								</td>

								{/* Ports */}
								<td className="py-3 px-4 text-xs font-mono text-muted-foreground max-w-[140px] truncate" title={c.ports}>
									{c.ports ? (
										<span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
											{c.ports}
										</span>
									) : (
										<span className="text-muted-foreground">-</span>
									)}
								</td>

								{/* Status Text */}
								<td className="py-3 px-4 text-xs text-muted-foreground font-mono">
									{c.statusText}
								</td>

								{/* Actions & Logs */}
								<td className="py-3 px-4 text-right">
									<div className="flex items-center justify-end gap-1">
										{/* Logs Button */}
										<Button
											variant="ghost"
											size="sm"
											className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
											title="View Live Logs"
											onClick={() => onOpenLogs({ id: c.id, name: c.name, systemId: c.systemId, isLocal: c.isLocal })}
										>
											<FileText className="h-3.5 w-3.5" />
											Logs
										</Button>

										{/* Inspect Button */}
										<Button
											variant="ghost"
											size="sm"
											className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
											title="Inspect JSON Metadata"
											onClick={() => onOpenInspect({ id: c.id, name: c.name, systemId: c.systemId, isLocal: c.isLocal })}
										>
											<Info className="h-3.5 w-3.5" />
											Inspect
										</Button>

										{/* Local Docker Controls (if local container) */}
										{c.isLocal && c.rawLocal && (
											<>
												{isRunning ? (
													<>
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7 text-amber-500 hover:bg-amber-500/10"
															title="Restart container"
															disabled={isLoading}
															onClick={() => onAction(c.id, "restart")}
														>
															<RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7 text-destructive hover:bg-destructive/10"
															title="Stop container"
															disabled={isLoading}
															onClick={() => onAction(c.id, "stop")}
														>
															<Square className="h-3.5 w-3.5" />
														</Button>
													</>
												) : isPaused ? (
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
														title="Unpause container"
														disabled={isLoading}
														onClick={() => onAction(c.id, "unpause")}
													>
														<Play className="h-3.5 w-3.5" />
													</Button>
												) : (
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
														title="Start container"
														disabled={isLoading}
														onClick={() => onAction(c.id, "start")}
													>
														<Play className="h-3.5 w-3.5" />
													</Button>
												)}

												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
													title="Force Remove Container"
													onClick={() => onDeleteLocal(c.rawLocal!)}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</>
										)}
									</div>
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}
