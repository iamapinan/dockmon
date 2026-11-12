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
	Clock,
	Search,
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

export default function Domains() {
	const systems = useStore($systems)
	const [domains, setDomains] = useState<DomainItem[]>([])
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState("")
	const [filter, setFilter] = useState<"all" | "up" | "degraded" | "down">("all")

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

	useEffect(() => {
		fetchDomains()
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
		} catch (err) {
			console.error("Failed to add domain", err)
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
		} catch (err) {
			console.error("Failed to delete domain", err)
		}
	}

	const filteredDomains = domains.filter((d) => {
		const matchesSearch =
			d.name.toLowerCase().includes(search.toLowerCase()) ||
			d.url.toLowerCase().includes(search.toLowerCase()) ||
			(d.serverName && d.serverName.toLowerCase().includes(search.toLowerCase()))
		const matchesFilter = filter === "all" || d.status === filter
		return matchesSearch && matchesFilter
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
						Real-time HTTP health, latency, SSL expiration monitoring, and Cloudflare DNS management.
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

			<Tabs defaultValue="endpoints" className="w-full">
				<TabsList className="grid w-full max-w-md grid-cols-2">
					<TabsTrigger value="endpoints">HTTP & SSL Monitors</TabsTrigger>
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
					<div className="text-2xl font-bold mt-1">{domains.length}</div>
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
						OFFLINE / ERROR
					</div>
					<div className="text-2xl font-bold mt-1 text-red-500">{countDown}</div>
				</div>
			</div>

			{/* Filter & Search Bar */}
			<div className="flex items-center gap-3">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search domain, host, or server..."
						className="pl-9"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<Button
					variant="outline"
					size="icon"
					title="Refresh all"
					onClick={fetchDomains}
					disabled={loading}
				>
					<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
				</Button>
			</div>

			{/* Domains Table / List */}
			{filteredDomains.length === 0 ? (
				<div className="text-center py-16 border rounded-xl bg-card/30">
					<Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
					<h3 className="font-semibold text-base">No domains found</h3>
					<p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
						Add your domains or connect Cloudflare to automatically sync your web applications.
					</p>
					<div className="mt-4 flex justify-center gap-2">
						<Button onClick={() => setAddOpen(true)} className="gap-2">
							<Plus className="h-4 w-4" /> Add Domain
						</Button>
						<Button variant="outline" onClick={() => setCfOpen(true)} className="gap-2 text-amber-500">
							<Cloud className="h-4 w-4" /> Cloudflare Connect
						</Button>
					</div>
				</div>
			) : (
				<div className="border rounded-xl bg-card/60 backdrop-blur overflow-hidden shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full text-sm text-left">
							<thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b font-medium">
								<tr>
									<th className="px-4 py-3">Domain / URL</th>
									<th className="px-4 py-3">Server Node</th>
									<th className="px-4 py-3">HTTP Status</th>
									<th className="px-4 py-3">Latency</th>
									<th className="px-4 py-3">SSL Certificate</th>
									<th className="px-4 py-3">Cloudflare</th>
									<th className="px-4 py-3 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{filteredDomains.map((d) => (
									<tr key={d.id} className="hover:bg-muted/30 transition">
										<td className="px-4 py-3 font-medium">
											<div className="flex items-center gap-2">
												<span
													className={`h-2.5 w-2.5 rounded-full shrink-0 ${
														d.status === "up"
															? "bg-green-500"
															: d.status === "degraded"
																? "bg-amber-500"
																: d.status === "down"
																	? "bg-red-500"
																	: "bg-muted-foreground"
													}`}
												/>
												<a
													href={d.url}
													target="_blank"
													rel="noreferrer"
													className="hover:underline flex items-center gap-1.5 font-semibold text-foreground group"
												>
													{d.name}
													<ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition text-muted-foreground" />
												</a>
											</div>
											<div className="text-xs text-muted-foreground font-mono pl-4 mt-0.5">
												{d.url}
											</div>
										</td>
										<td className="px-4 py-3 text-muted-foreground">
											{d.serverName ? (
												<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono bg-muted border">
													<Server className="h-3 w-3 text-primary" />
													{d.serverName}
												</span>
											) : (
												<span className="text-xs text-muted-foreground font-mono">External</span>
											)}
										</td>
										<td className="px-4 py-3">
											{d.statusCode > 0 ? (
												<span
													className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
														d.statusCode < 400
															? "bg-green-500/15 text-green-500"
															: "bg-red-500/15 text-red-500"
													}`}
												>
													{d.statusCode} {d.statusCode === 200 ? "OK" : ""}
												</span>
											) : (
												<span className="text-xs text-muted-foreground">Pending</span>
											)}
										</td>
										<td className="px-4 py-3 font-mono text-xs">
											{d.responseTimeMs > 0 ? (
												<span className="flex items-center gap-1">
													<Clock className="h-3 w-3 text-muted-foreground" />
													{d.responseTimeMs} ms
												</span>
											) : (
												"-"
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
				onImportSuccess={fetchDomains}
			/>
		</div>
	)
}
