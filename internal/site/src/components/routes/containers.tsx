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
	Trash2,
	Network,
	HardDrive,
	Search,
	RefreshCw,
	Plus,
	Server,
	Cpu,
	MemoryStick,
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
	const [selectedServer, setSelectedServer] = useState<string>("all")

	// Local Docker State
	const [localContainers, setLocalContainers] = useState<DockerContainer[]>([])
	const [loadingLocal, setLoadingLocal] = useState(false)
	const [dockerInfo, setDockerInfo] = useState<{ available: boolean; error?: string } | null>(null)

	// Remote Container Records (from PocketBase agent telemetry)
	const [agentContainers, setAgentContainers] = useState<ContainerRecord[]>([])
	const [loadingAgent, setLoadingAgent] = useState(false)

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

	// Active server object
	const activeSystem = systems.find((s) => s.id === selectedServer)

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

				<div className="flex flex-wrap items-center gap-2">
					{/* Host / Server Select Box on Toolbar */}
					<div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60">
						<Server className="h-3.5 w-3.5 text-primary shrink-0" />
						<select
							className="h-7 pl-1.5 pr-4 rounded-md bg-background text-xs font-medium border border-input focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[200px] sm:max-w-[260px] truncate"
							value={selectedServer}
							onChange={(e) => setSelectedServer(e.target.value)}
							aria-label="Select Host / Server"
						>
							<option value="all">🌐 All Hosts ({allUnified.length})</option>
							{systems.map((s) => {
								const count = unifiedAgent.filter((c) => c.systemId === s.id).length
								const cfCount = cfServerCounts[s.id] || 0
								return (
									<option key={s.id} value={s.id}>
										{s.name} ({s.host}) — {count} containers{cfCount > 0 ? ` • ${cfCount} CF` : ""}
									</option>
								)
							})}
							<option value="local">
								💻 Local Docker ({unifiedLocal.length})
							</option>
						</select>
					</div>

					<Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={refreshAll}>
						<RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingAgent || loadingLocal ? "animate-spin" : ""}`} />
						Refresh
					</Button>
				</div>
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
					<ContainersTable systemId={selectedServer === "all" ? undefined : selectedServer} />
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

			<FooterRepoLink />
		</div>
	)
})
