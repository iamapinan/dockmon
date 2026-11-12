import { useEffect, useState, memo } from "react"
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
import {
	Container,
	Play,
	Square,
	RotateCw,
	Pause,
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
} from "lucide-react"
import ContainersTable from "@/components/containers-table/containers-table"
import { FooterRepoLink } from "@/components/footer-repo-link"

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

export default memo(() => {
	const [activeTab, setActiveTab] = useState("containers")
	const [viewMode, setViewMode] = useState<"manage" | "stats">("manage")

	// Containers State
	const [containers, setContainers] = useState<DockerContainer[]>([])
	const [loadingContainers, setLoadingContainers] = useState(true)
	const [containerSearch, setContainerSearch] = useState("")
	const [containerFilter, setContainerFilter] = useState<"all" | "running" | "paused" | "exited">("all")
	const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

	// Networks State
	const [networks, setNetworks] = useState<DockerNetwork[]>([])
	const [loadingNetworks, setLoadingNetworks] = useState(false)
	const [networkSearch, setNetworkSearch] = useState("")
	const [newNetworkName, setNewNetworkName] = useState("")
	const [newNetworkDriver, setNewNetworkDriver] = useState("bridge")
	const [networkModalOpen, setNetworkModalOpen] = useState(false)
	const [networkToDelete, setNetworkToDelete] = useState<DockerNetwork | null>(null)

	// Volumes State
	const [volumes, setVolumes] = useState<DockerVolume[]>([])
	const [loadingVolumes, setLoadingVolumes] = useState(false)
	const [volumeSearch, setVolumeSearch] = useState("")
	const [newVolumeName, setNewVolumeName] = useState("")
	const [newVolumeDriver, setNewVolumeDriver] = useState("local")
	const [volumeModalOpen, setVolumeModalOpen] = useState(false)
	const [volumeToDelete, setVolumeToDelete] = useState<DockerVolume | null>(null)

	// Logs Modal
	const [logsOpen, setLogsOpen] = useState(false)
	const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null)
	const [logsContent, setLogsContent] = useState("")
	const [loadingLogs, setLoadingLogs] = useState(false)
	const [logsCopied, setLogsCopied] = useState(false)

	// Inspect Modal
	const [inspectOpen, setInspectOpen] = useState(false)
	const [inspectData, setInspectData] = useState<any>(null)
	const [loadingInspect, setLoadingInspect] = useState(false)

	// Delete Container Modal
	const [containerToDelete, setContainerToDelete] = useState<DockerContainer | null>(null)

	// Docker Daemon Info
	const [dockerInfo, setDockerInfo] = useState<{ available: boolean; error?: string } | null>(null)

	useEffect(() => {
		document.title = "Containers & Docker Management / DockMon"
		fetchContainers()
		fetchDockerStatus()
	}, [])

	const fetchDockerStatus = async () => {
		try {
			const res = await pb.send<any>("/api/dockmon/docker/status", {})
			setDockerInfo(res)
		} catch (err: any) {
			setDockerInfo({ available: false, error: err.message })
		}
	}

	const fetchContainers = async () => {
		setLoadingContainers(true)
		try {
			const res = await pb.send<DockerContainer[]>("/api/dockmon/docker/containers", {})
			setContainers(res || [])
		} catch (err) {
			console.error("Failed to load containers", err)
		} finally {
			setLoadingContainers(false)
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

	const handleContainerAction = async (id: string, action: string) => {
		setActionLoading((prev) => ({ ...prev, [id]: true }))
		try {
			await pb.send(`/api/dockmon/docker/containers/${id}/action`, {
				method: "POST",
				body: { action },
			})
			fetchContainers()
		} catch (err: any) {
			alert(`Action failed: ${err.message || err}`)
		} finally {
			setActionLoading((prev) => ({ ...prev, [id]: false }))
		}
	}

	const openLogs = async (c: DockerContainer) => {
		setSelectedContainer(c)
		setLogsOpen(true)
		setLoadingLogs(true)
		setLogsCopied(false)
		try {
			const res = await pb.send<{ logs: string }>(`/api/dockmon/docker/containers/${c.Id}/logs?tail=300`, {})
			setLogsContent(res.logs || "(No log output recorded)")
		} catch (err: any) {
			setLogsContent(`Error retrieving logs: ${err.message || err}`)
		} finally {
			setLoadingLogs(false)
		}
	}

	const openInspect = async (c: DockerContainer) => {
		setSelectedContainer(c)
		setInspectOpen(true)
		setLoadingInspect(true)
		try {
			const res = await pb.send<any>(`/api/dockmon/docker/containers/${c.Id}/inspect`, {})
			setInspectData(res)
		} catch (err: any) {
			setInspectData({ error: err.message || "Failed to inspect container" })
		} finally {
			setLoadingInspect(false)
		}
	}

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
			await pb.send(`/api/dockmon/docker/volumes/${volumeToDelete.Name}`, {
				method: "DELETE",
			})
			setVolumeToDelete(null)
			fetchVolumes()
		} catch (err: any) {
			alert(`Failed to remove volume: ${err.message}`)
		}
	}

	const handlePruneVolumes = async () => {
		if (!confirm("Are you sure you want to prune all unused Docker volumes?")) return
		try {
			await pb.send("/api/dockmon/docker/volumes/prune", { method: "POST" })
			fetchVolumes()
		} catch (err: any) {
			alert(`Prune failed: ${err.message}`)
		}
	}

	const filteredContainers = containers.filter((c) => {
		const name = (c.Names[0] || "").replace(/^\//, "")
		const matchSearch =
			name.toLowerCase().includes(containerSearch.toLowerCase()) ||
			c.Image.toLowerCase().includes(containerSearch.toLowerCase()) ||
			c.Id.toLowerCase().includes(containerSearch.toLowerCase())
		const matchFilter = containerFilter === "all" || c.State === containerFilter
		return matchSearch && matchFilter
	})

	const runningCount = containers.filter((c) => c.State === "running").length
	const pausedCount = containers.filter((c) => c.State === "paused").length
	const stoppedCount = containers.filter((c) => c.State === "exited" || c.State === "dead").length

	return (
		<div className="space-y-6 pb-12">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
						<Container className="h-6 w-6 text-primary" />
						Docker Management &amp; Control
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						View, control, and inspect containers, manage virtual networks, and inspect storage volumes.
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
								Live Control
							</Button>
							<Button
								variant={viewMode === "stats" ? "default" : "ghost"}
								size="sm"
								className="h-7 text-xs gap-1.5"
								onClick={() => setViewMode("stats")}
							>
								<Activity className="h-3.5 w-3.5" />
								Resource Stats
							</Button>
						</div>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							if (activeTab === "containers") fetchContainers()
							else if (activeTab === "networks") fetchNetworks()
							else if (activeTab === "volumes") fetchVolumes()
						}}
					>
						<RefreshCw className="h-3.5 w-3.5 mr-1.5" />
						Refresh
					</Button>
				</div>
			</div>

			{dockerInfo && !dockerInfo.available && (
				<div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
					<div>
						<div className="font-semibold">Docker Daemon Not Accessible</div>
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
						Containers
					</TabsTrigger>
					<TabsTrigger value="networks" className="gap-1.5">
						<Network className="h-4 w-4" />
						Networks
					</TabsTrigger>
					<TabsTrigger value="volumes" className="gap-1.5">
						<HardDrive className="h-4 w-4" />
						Volumes
					</TabsTrigger>
				</TabsList>

				{/* ---------------- CONTAINERS TAB ---------------- */}
				<TabsContent value="containers" className="space-y-6 mt-6">
					{viewMode === "stats" ? (
						<ContainersTable />
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
									<div className="text-2xl font-bold mt-1">{containers.length}</div>
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
									<div className="text-2xl font-bold mt-1 text-emerald-500">{runningCount}</div>
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
									<div className="text-2xl font-bold mt-1 text-amber-500">{pausedCount}</div>
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
									<div className="text-2xl font-bold mt-1 text-destructive">{stoppedCount}</div>
								</div>
							</div>

							{/* Search Bar */}
							<div className="flex items-center justify-between gap-3">
								<div className="relative flex-1 max-w-sm">
									<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search containers by name, image, id..."
										value={containerSearch}
										onChange={(e) => setContainerSearch(e.target.value)}
										className="pl-9 h-9"
									/>
								</div>
							</div>

							{/* Containers Control Table */}
							<div className="rounded-xl border border-border/60 bg-card overflow-hidden">
								{loadingContainers ? (
									<div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
										<RefreshCw className="h-6 w-6 animate-spin text-primary" />
										<p className="text-sm">Querying Docker Engine...</p>
									</div>
								) : filteredContainers.length === 0 ? (
									<div className="p-12 text-center text-muted-foreground">
										<Container className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
										<p className="text-sm">No containers found</p>
									</div>
								) : (
									<div className="overflow-x-auto">
										<table className="w-full text-left text-sm">
											<thead>
												<tr className="border-b border-border/60 bg-muted/40 text-xs font-medium text-muted-foreground">
													<th className="py-3 px-4">State</th>
													<th className="py-3 px-4">Name / ID</th>
													<th className="py-3 px-4">Image</th>
													<th className="py-3 px-4">Ports</th>
													<th className="py-3 px-4">Status / Uptime</th>
													<th className="py-3 px-4 text-right">Control &amp; Actions</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-border/40">
												{filteredContainers.map((c) => {
													const name = (c.Names[0] || "").replace(/^\//, "")
													const shortId = c.Id.slice(0, 12)
													const isRunning = c.State === "running"
													const isPaused = c.State === "paused"
													const isLoading = actionLoading[c.Id]

													return (
														<tr key={c.Id} className="hover:bg-muted/20 transition-colors">
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
															<td className="py-3 px-4">
																<div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
																	{name}
																</div>
																<div className="font-mono text-[11px] text-muted-foreground mt-0.5">
																	{shortId}
																</div>
															</td>
															<td className="py-3 px-4 font-mono text-xs text-muted-foreground max-w-xs truncate" title={c.Image}>
																{c.Image}
															</td>
															<td className="py-3 px-4 text-xs font-mono text-muted-foreground">
																{c.Ports && c.Ports.length > 0 ? (
																	<div className="flex flex-wrap gap-1">
																		{c.Ports.slice(0, 3).map((p, idx) => (
																			<span key={idx} className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
																				{p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : p.PrivatePort}/{p.Type}
																			</span>
																		))}
																		{c.Ports.length > 3 && (
																			<span className="text-[10px] text-muted-foreground">+{c.Ports.length - 3}</span>
																		)}
																	</div>
																) : (
																	<span className="text-muted-foreground/60">-</span>
																)}
															</td>
															<td className="py-3 px-4 text-xs text-muted-foreground">
																{c.Status}
															</td>
															<td className="py-3 px-4 text-right">
																<div className="flex items-center justify-end gap-1">
																	{/* Controls */}
																	{isRunning ? (
																		<>
																			<Button
																				variant="outline"
																				size="icon"
																				className="h-7 w-7 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
																				title="Restart container"
																				onClick={() => handleContainerAction(c.Id, "restart")}
																				disabled={isLoading}
																			>
																				<RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
																			</Button>
																			<Button
																				variant="outline"
																				size="icon"
																				className="h-7 w-7 text-destructive hover:bg-destructive/10"
																				title="Stop container"
																				onClick={() => handleContainerAction(c.Id, "stop")}
																				disabled={isLoading}
																			>
																				<Square className="h-3 w-3 fill-current" />
																			</Button>
																			<Button
																				variant="ghost"
																				size="icon"
																				className="h-7 w-7 text-muted-foreground"
																				title="Pause container"
																				onClick={() => handleContainerAction(c.Id, "pause")}
																				disabled={isLoading}
																			>
																				<Pause className="h-3.5 w-3.5" />
																			</Button>
																		</>
																	) : isPaused ? (
																		<Button
																			variant="outline"
																			size="icon"
																			className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
																			title="Unpause container"
																			onClick={() => handleContainerAction(c.Id, "unpause")}
																			disabled={isLoading}
																		>
																			<Play className="h-3.5 w-3.5 fill-current" />
																		</Button>
																	) : (
																		<Button
																			variant="outline"
																			size="icon"
																			className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
																			title="Start container"
																			onClick={() => handleContainerAction(c.Id, "start")}
																			disabled={isLoading}
																		>
																			<Play className="h-3.5 w-3.5 fill-current" />
																		</Button>
																	)}

																	{/* Inspect & Logs */}
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7 text-muted-foreground hover:text-foreground"
																		title="View logs"
																		onClick={() => openLogs(c)}
																	>
																		<FileText className="h-3.5 w-3.5" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7 text-muted-foreground hover:text-foreground"
																		title="Inspect details"
																		onClick={() => openInspect(c)}
																	>
																		<Info className="h-3.5 w-3.5" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7 text-destructive/80 hover:text-destructive"
																		title="Remove container"
																		onClick={() => setContainerToDelete(c)}
																	>
																		<Trash2 className="h-3.5 w-3.5" />
																	</Button>
																</div>
															</td>
														</tr>
													)
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</>
					)}
				</TabsContent>

				{/* ---------------- NETWORKS TAB ---------------- */}
				<TabsContent value="networks" className="space-y-6 mt-6">
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/60 p-4 rounded-xl border border-border/50">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
								<Network className="h-5 w-5" />
							</div>
							<div>
								<h3 className="font-semibold text-foreground text-base">Docker Virtual Networks</h3>
								<p className="text-xs text-muted-foreground">Inspect bridge, overlay, and host networks connecting your containers.</p>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handlePruneNetworks}>
								<Trash2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
								Prune Unused
							</Button>
							<Button size="sm" onClick={() => setNetworkModalOpen(true)}>
								<Plus className="h-3.5 w-3.5 mr-1" />
								Create Network
							</Button>
						</div>
					</div>

					{/* Search */}
					<div className="flex items-center justify-between gap-3">
						<div className="relative flex-1 max-w-sm">
							<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search networks..."
								value={networkSearch}
								onChange={(e) => setNetworkSearch(e.target.value)}
								className="pl-9 h-9"
							/>
						</div>
					</div>

					{/* Networks Table */}
					<div className="rounded-xl border border-border/60 bg-card overflow-hidden">
						{loadingNetworks ? (
							<div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
								<RefreshCw className="h-6 w-6 animate-spin text-primary" />
								<p className="text-sm">Loading Docker networks...</p>
							</div>
						) : networks.length === 0 ? (
							<div className="p-12 text-center text-muted-foreground">
								<Network className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
								<p className="text-sm">No networks found</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead>
										<tr className="border-b border-border/60 bg-muted/40 text-xs font-medium text-muted-foreground">
											<th className="py-3 px-4">Network Name</th>
											<th className="py-3 px-4">Driver</th>
											<th className="py-3 px-4">Scope</th>
											<th className="py-3 px-4">Subnet / Gateway</th>
											<th className="py-3 px-4">Connected Containers</th>
											<th className="py-3 px-4 text-right">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/40">
										{networks
											.filter((n) => n.Name.toLowerCase().includes(networkSearch.toLowerCase()))
											.map((net) => {
												const containerList = net.Containers ? Object.values(net.Containers) : []
												const ipConfig = net.IPAM?.Config?.[0]
												const isSystemNet = ["bridge", "host", "none"].includes(net.Name)

												return (
													<tr key={net.Id} className="hover:bg-muted/20 transition-colors">
														<td className="py-3 px-4">
															<div className="font-semibold text-foreground font-mono text-xs">
																{net.Name}
															</div>
															<div className="text-[10px] text-muted-foreground font-mono">
																{net.Id.slice(0, 12)}
															</div>
														</td>
														<td className="py-3 px-4">
															<span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
																{net.Driver}
															</span>
														</td>
														<td className="py-3 px-4 text-xs text-muted-foreground">{net.Scope}</td>
														<td className="py-3 px-4 font-mono text-xs text-muted-foreground">
															{ipConfig?.Subnet ? (
																<div>
																	<div>{ipConfig.Subnet}</div>
																	{ipConfig.Gateway && (
																		<div className="text-[10px] text-muted-foreground/70">
																			GW: {ipConfig.Gateway}
																		</div>
																	)}
																</div>
															) : (
																"-"
															)}
														</td>
														<td className="py-3 px-4">
															{containerList.length > 0 ? (
																<div className="flex flex-wrap gap-1">
																	{containerList.map((c, i) => (
																		<span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-primary/10 text-primary">
																			{c.Name}
																		</span>
																	))}
																</div>
															) : (
																<span className="text-xs text-muted-foreground/60">None attached</span>
															)}
														</td>
														<td className="py-3 px-4 text-right">
															{!isSystemNet && (
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7 text-destructive/80 hover:text-destructive"
																	title="Remove network"
																	onClick={() => setNetworkToDelete(net)}
																>
																	<Trash2 className="h-3.5 w-3.5" />
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

				{/* ---------------- VOLUMES TAB ---------------- */}
				<TabsContent value="volumes" className="space-y-6 mt-6">
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/60 p-4 rounded-xl border border-border/50">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
								<HardDrive className="h-5 w-5" />
							</div>
							<div>
								<h3 className="font-semibold text-foreground text-base">Docker Storage Volumes</h3>
								<p className="text-xs text-muted-foreground">Inspect persistent data volumes and storage mounts across containers.</p>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handlePruneVolumes}>
								<Trash2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
								Prune Dangling
							</Button>
							<Button size="sm" onClick={() => setVolumeModalOpen(true)}>
								<Plus className="h-3.5 w-3.5 mr-1" />
								Create Volume
							</Button>
						</div>
					</div>

					{/* Search */}
					<div className="flex items-center justify-between gap-3">
						<div className="relative flex-1 max-w-sm">
							<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search volumes..."
								value={volumeSearch}
								onChange={(e) => setVolumeSearch(e.target.value)}
								className="pl-9 h-9"
							/>
						</div>
					</div>

					{/* Volumes Table */}
					<div className="rounded-xl border border-border/60 bg-card overflow-hidden">
						{loadingVolumes ? (
							<div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
								<RefreshCw className="h-6 w-6 animate-spin text-primary" />
								<p className="text-sm">Loading Docker volumes...</p>
							</div>
						) : volumes.length === 0 ? (
							<div className="p-12 text-center text-muted-foreground">
								<HardDrive className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
								<p className="text-sm">No volumes found</p>
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
													<td className="py-3 px-4 font-mono text-xs font-semibold text-foreground max-w-xs truncate" title={vol.Name}>
														{vol.Name}
													</td>
													<td className="py-3 px-4">
														<span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
															{vol.Driver}
														</span>
													</td>
													<td className="py-3 px-4 font-mono text-xs text-muted-foreground max-w-sm truncate" title={vol.Mountpoint}>
														{vol.Mountpoint}
													</td>
													<td className="py-3 px-4 text-xs text-muted-foreground">
														{vol.CreatedAt ? new Date(vol.CreatedAt).toLocaleDateString() : "-"}
													</td>
													<td className="py-3 px-4 text-right">
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7 text-destructive/80 hover:text-destructive"
															title="Remove volume"
															onClick={() => setVolumeToDelete(vol)}
														>
															<Trash2 className="h-3.5 w-3.5" />
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

			{/* Logs Dialog */}
			<Dialog open={logsOpen} onOpenChange={setLogsOpen}>
				<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
					<DialogHeader>
						<DialogTitle className="flex items-center justify-between text-base">
							<span className="flex items-center gap-2">
								<FileText className="h-4 w-4 text-primary" />
								Container Logs: {(selectedContainer?.Names[0] || "").replace(/^\//, "")}
							</span>
							<Button
								variant="outline"
								size="sm"
								className="h-7 text-xs gap-1.5 mr-6"
								onClick={() => {
									navigator.clipboard.writeText(logsContent)
									setLogsCopied(true)
									setTimeout(() => setLogsCopied(false), 2000)
								}}
							>
								{logsCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
								{logsCopied ? "Copied" : "Copy"}
							</Button>
						</DialogTitle>
						<DialogDescription>
							Recent stdout and stderr output from container
						</DialogDescription>
					</DialogHeader>

					<div className="flex-1 bg-black/90 text-emerald-400 font-mono text-xs p-4 rounded-lg overflow-auto border border-border/40 whitespace-pre max-h-[60vh]">
						{loadingLogs ? (
							<div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
								<RefreshCw className="h-4 w-4 animate-spin text-primary" />
								Streaming logs...
							</div>
						) : (
							logsContent
						)}
					</div>

					<DialogFooter className="flex items-center justify-between">
						<Button
							variant="outline"
							size="sm"
							onClick={() => selectedContainer && openLogs(selectedContainer)}
							disabled={loadingLogs}
						>
							<RefreshCw className={`h-3 w-3 mr-1.5 ${loadingLogs ? "animate-spin" : ""}`} />
							Refresh Logs
						</Button>
						<Button size="sm" onClick={() => setLogsOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Inspect Dialog */}
			<Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
				<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-base">
							<Info className="h-4 w-4 text-primary" />
							Inspect Container: {(selectedContainer?.Names[0] || "").replace(/^\//, "")}
						</DialogTitle>
						<DialogDescription>
							Configuration, environment, mounts, and network state
						</DialogDescription>
					</DialogHeader>

					<div className="flex-1 overflow-auto max-h-[60vh] space-y-4 py-2 text-xs">
						{loadingInspect ? (
							<div className="p-8 text-center text-muted-foreground">Loading inspect data...</div>
						) : inspectData ? (
							<div className="space-y-4">
								<div>
									<h4 className="font-semibold text-foreground mb-1.5">Environment Variables</h4>
									<div className="bg-muted/50 p-2.5 rounded-lg font-mono text-[11px] max-h-36 overflow-auto space-y-1">
										{inspectData.Config?.Env?.map((env: string, idx: number) => (
											<div key={idx} className="truncate">
												{env}
											</div>
										)) || <span className="text-muted-foreground">No custom environment variables</span>}
									</div>
								</div>

								<div>
									<h4 className="font-semibold text-foreground mb-1.5">Mounts &amp; Storage</h4>
									<div className="bg-muted/50 p-2.5 rounded-lg space-y-1 text-[11px]">
										{inspectData.Mounts?.map((m: any, idx: number) => (
											<div key={idx} className="font-mono">
												<span className="text-primary font-semibold">[{m.Type}]</span> {m.Source} &rarr; {m.Destination}
											</div>
										)) || <span className="text-muted-foreground">No mounts</span>}
									</div>
								</div>

								<div>
									<h4 className="font-semibold text-foreground mb-1.5">Raw JSON Inspect</h4>
									<pre className="bg-muted/40 p-3 rounded-lg font-mono text-[10px] overflow-auto max-h-48 text-muted-foreground">
										{JSON.stringify(inspectData, null, 2)}
									</pre>
								</div>
							</div>
						) : null}
					</div>

					<DialogFooter>
						<Button size="sm" onClick={() => setInspectOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Create Network Dialog */}
			<Dialog open={networkModalOpen} onOpenChange={setNetworkModalOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Create Virtual Network</DialogTitle>
						<DialogDescription>Create a new isolated Docker network for container communication.</DialogDescription>
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

			{/* Delete Container Dialog */}
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
								await handleContainerAction(containerToDelete.Id, "remove")
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
