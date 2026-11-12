import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
	Cloud,
	Plus,
	RefreshCw,
	Search,
	Trash2,
	Edit,
	CheckCircle2,
	AlertCircle,
	XCircle,
	Globe,
	Zap,
	Server,
} from "lucide-react"

export interface DNSRecord {
	id: string
	zone_id: string
	zone_name: string
	name: string
	type: string
	content: string
	proxiable: boolean
	proxied: boolean
	ttl: number
	comment?: string
	created_on?: string
	modified_on?: string
}

export interface ZoneItem {
	id: string
	name: string
	status: string
}

interface DNSCheckResult {
	status: "resolved" | "mismatch" | "failed"
	resolved?: string[]
	latencyMs: number
	message: string
}

export function CloudflareDNSView({ onOpenConnect }: { onOpenConnect: () => void }) {
	const systems = useStore($systems)
	const [zones, setZones] = useState<ZoneItem[]>([])
	const [selectedZone, setSelectedZone] = useState<string>("")
	const [records, setRecords] = useState<DNSRecord[]>([])
	const [, setLoadingZones] = useState(true)
	const [loadingRecords, setLoadingRecords] = useState(false)
	const [search, setSearch] = useState("")
	const [typeFilter, setTypeFilter] = useState("ALL")
	const [serverFilter, setServerFilter] = useState("ALL")
	const [error, setError] = useState<string | null>(null)

	// Resolution test cache: recordId -> result
	const [checkResults, setCheckResults] = useState<Record<string, DNSCheckResult>>({})
	const [checkingRecords, setCheckingRecords] = useState<Record<string, boolean>>({})

	// Add/Edit Record state
	const [modalOpen, setModalOpen] = useState(false)
	const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null)
	const [recordType, setRecordType] = useState("A")
	const [recordName, setRecordName] = useState("")
	const [recordContent, setRecordContent] = useState("")
	const [recordTTL, setRecordTTL] = useState<number>(1)
	const [recordProxied, setRecordProxied] = useState(true)
	const [recordComment, setRecordComment] = useState("")
	const [saving, setSaving] = useState(false)

	// Delete state
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [recordToDelete, setRecordToDelete] = useState<DNSRecord | null>(null)
	const [deleting, setDeleting] = useState(false)

	const fetchZones = async () => {
		setLoadingZones(true)
		setError(null)
		try {
			const res = await pb.send<{ result?: ZoneItem[] }>("/api/dockmon/cloudflare/zones", {})
			if (res.result && Array.isArray(res.result)) {
				setZones(res.result)
				if (res.result.length > 0 && !selectedZone) {
					setSelectedZone(res.result[0].id)
				}
			} else {
				setZones([])
			}
		} catch (err: any) {
			setError(err.message || "Cloudflare API token not configured")
		} finally {
			setLoadingZones(false)
		}
	}

	const fetchRecords = async (zoneId: string) => {
		if (!zoneId) return
		setLoadingRecords(true)
		setError(null)
		try {
			const res = await pb.send<{ result?: DNSRecord[] }>(`/api/dockmon/cloudflare/zones/${zoneId}/dns`, {})
			setRecords(res.result || [])
		} catch (err: any) {
			setError(err.message || "Failed to fetch DNS records")
		} finally {
			setLoadingRecords(false)
		}
	}

	useEffect(() => {
		fetchZones()
	}, [])

	useEffect(() => {
		if (selectedZone) {
			fetchRecords(selectedZone)
		}
	}, [selectedZone])

	const openAddModal = () => {
		setEditingRecord(null)
		setRecordType("A")
		setRecordName("")
		setRecordContent("")
		setRecordTTL(1)
		setRecordProxied(true)
		setRecordComment("")
		setModalOpen(true)
	}

	const openEditModal = (rec: DNSRecord) => {
		setEditingRecord(rec)
		setRecordType(rec.type)
		setRecordName(rec.name)
		setRecordContent(rec.content)
		setRecordTTL(rec.ttl)
		setRecordProxied(rec.proxied)
		setRecordComment(rec.comment || "")
		setModalOpen(true)
	}

	const handleSaveRecord = async () => {
		if (!selectedZone || !recordName || !recordContent) return
		setSaving(true)
		setError(null)

		const payload = {
			type: recordType,
			name: recordName,
			content: recordContent,
			ttl: Number(recordTTL),
			proxied: recordType === "A" || recordType === "AAAA" || recordType === "CNAME" ? recordProxied : false,
			comment: recordComment,
		}

		try {
			if (editingRecord) {
				await pb.send(`/api/dockmon/cloudflare/zones/${selectedZone}/dns/${editingRecord.id}`, {
					method: "PUT",
					body: payload,
				})
			} else {
				await pb.send(`/api/dockmon/cloudflare/zones/${selectedZone}/dns`, {
					method: "POST",
					body: payload,
				})
			}
			setModalOpen(false)
			fetchRecords(selectedZone)
		} catch (err: any) {
			setError(err.message || "Failed to save DNS record")
		} finally {
			setSaving(false)
		}
	}

	const handleDeleteRecord = async () => {
		if (!selectedZone || !recordToDelete) return
		setDeleting(true)
		try {
			await pb.send(`/api/dockmon/cloudflare/zones/${selectedZone}/dns/${recordToDelete.id}`, {
				method: "DELETE",
			})
			setDeleteOpen(false)
			setRecordToDelete(null)
			fetchRecords(selectedZone)
		} catch (err: any) {
			setError(err.message || "Failed to delete record")
		} finally {
			setDeleting(false)
		}
	}

	const checkRecordResolution = async (rec: DNSRecord) => {
		setCheckingRecords((prev) => ({ ...prev, [rec.id]: true }))
		try {
			const res = await pb.send<DNSCheckResult>("/api/dockmon/cloudflare/dns/check", {
				method: "POST",
				body: {
					name: rec.name,
					expectedContent: rec.content,
					type: rec.type,
					proxied: rec.proxied,
				},
			})
			setCheckResults((prev) => ({ ...prev, [rec.id]: res }))
		} catch (err: any) {
			setCheckResults((prev) => ({
				...prev,
				[rec.id]: {
					status: "failed",
					latencyMs: 0,
					message: err.message || "Probe failed",
				},
			}))
		} finally {
			setCheckingRecords((prev) => ({ ...prev, [rec.id]: false }))
		}
	}

	const checkAllResolutions = async () => {
		const targetRecords = records.filter((r) => ["A", "AAAA", "CNAME"].includes(r.type))
		for (const rec of targetRecords) {
			checkRecordResolution(rec)
		}
	}

	const filteredRecords = records.filter((r) => {
		const matchSearch =
			r.name.toLowerCase().includes(search.toLowerCase()) ||
			r.content.toLowerCase().includes(search.toLowerCase()) ||
			(r.comment && r.comment.toLowerCase().includes(search.toLowerCase()))
		const matchType = typeFilter === "ALL" || r.type === typeFilter
		const matchServer =
			serverFilter === "ALL" ||
			r.content === serverFilter ||
			(r.name.startsWith("*.") && r.content === serverFilter)
		return matchSearch && matchType && matchServer
	})

	const types = ["ALL", "A", "AAAA", "CNAME", "TXT", "MX", "NS"]

	return (
		<div className="space-y-6">
			{/* Zone Header / Controls */}
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/60 p-4 rounded-xl border border-border/50">
				<div className="flex items-center gap-3">
					<div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
						<Cloud className="h-5 w-5" />
					</div>
					<div>
						<h3 className="font-semibold text-foreground text-base">Cloudflare DNS Management</h3>
						<p className="text-xs text-muted-foreground">Manage DNS records and monitor propagation &amp; resolution health</p>
					</div>
				</div>

				<div className="flex items-center gap-2 w-full sm:w-auto">
					{zones.length > 0 && (
						<select
							className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
							value={selectedZone}
							onChange={(e) => setSelectedZone(e.target.value)}
						>
							{zones.map((z) => (
								<option key={z.id} value={z.id}>
									{z.name}
								</option>
							))}
						</select>
					)}
					<Button variant="outline" size="sm" onClick={onOpenConnect}>
						<Cloud className="h-3.5 w-3.5 mr-1.5 text-orange-500" />
						API Token
					</Button>
					<Button variant="outline" size="sm" onClick={() => selectedZone && fetchRecords(selectedZone)} disabled={loadingRecords}>
						<RefreshCw className={`h-3.5 w-3.5 ${loadingRecords ? "animate-spin" : ""}`} />
					</Button>
					<Button size="sm" onClick={openAddModal} disabled={!selectedZone}>
						<Plus className="h-3.5 w-3.5 mr-1" />
						Add Record
					</Button>
				</div>
			</div>

			{error && (
				<div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
					<span>{error}</span>
					<Button variant="outline" size="sm" onClick={onOpenConnect}>
						Configure Token
					</Button>
				</div>
			)}

			{/* Zone DNS Stats */}
			{selectedZone && records.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div className="p-3 rounded-lg border border-border/50 bg-card">
						<div className="text-xs text-muted-foreground">Total Records</div>
						<div className="text-xl font-bold mt-1">{records.length}</div>
					</div>
					<div className="p-3 rounded-lg border border-border/50 bg-card">
						<div className="text-xs text-muted-foreground">Proxied (CDN/WAF)</div>
						<div className="text-xl font-bold mt-1 text-orange-500">
							{records.filter((r) => r.proxied).length}
						</div>
					</div>
					<div className="p-3 rounded-lg border border-border/50 bg-card">
						<div className="text-xs text-muted-foreground">DNS Only</div>
						<div className="text-xl font-bold mt-1 text-muted-foreground">
							{records.filter((r) => !r.proxied).length}
						</div>
					</div>
					<div className="p-3 rounded-lg border border-border/50 bg-card flex flex-col justify-between">
						<div className="text-xs text-muted-foreground">DNS Monitoring</div>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs text-primary justify-start px-0 hover:bg-transparent"
							onClick={checkAllResolutions}
						>
							<Zap className="h-3.5 w-3.5 mr-1 text-amber-500" />
							Check All Records
						</Button>
					</div>
				</div>
			)}

			{/* Filter bar */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3">
				<div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
					<div className="relative w-full sm:w-64">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search DNS records..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9 h-9"
						/>
					</div>

					{systems.length > 0 && (
						<div className="flex items-center gap-1.5 w-full sm:w-auto">
							<Server className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
							<select
								className="h-9 px-2.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-48"
								value={serverFilter}
								onChange={(e) => setServerFilter(e.target.value)}
								title="Filter by target server"
							>
								<option value="ALL">All Target Servers</option>
								{systems.map((s) => (
									<option key={s.id} value={s.host}>
										{s.name} ({s.host})
									</option>
								))}
							</select>
						</div>
					)}
				</div>

				<div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
					{types.map((tp) => (
						<button
							key={tp}
							type="button"
							onClick={() => setTypeFilter(tp)}
							className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
								typeFilter === tp
									? "bg-primary text-primary-foreground"
									: "bg-muted/60 text-muted-foreground hover:bg-muted"
							}`}
						>
							{tp}
						</button>
					))}
				</div>
			</div>

			{/* DNS Table */}
			<div className="rounded-xl border border-border/60 overflow-hidden bg-card">
				{loadingRecords ? (
					<div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
						<RefreshCw className="h-6 w-6 animate-spin text-primary" />
						<p className="text-sm">Loading DNS records from Cloudflare...</p>
					</div>
				) : filteredRecords.length === 0 ? (
					<div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
						<Globe className="h-8 w-8 text-muted-foreground/40" />
						<p className="text-sm font-medium">No DNS records found</p>
						<p className="text-xs text-muted-foreground">
							{zones.length === 0
								? "Please connect your Cloudflare API token to view and manage DNS."
								: "Try adjusting your search or add a new DNS record."}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-b border-border/60 bg-muted/40 text-xs font-medium text-muted-foreground">
									<th className="py-3 px-4">Type</th>
									<th className="py-3 px-4">Name</th>
									<th className="py-3 px-4">Content</th>
									<th className="py-3 px-4">Proxy</th>
									<th className="py-3 px-4">TTL</th>
									<th className="py-3 px-4">DNS Health / Resolution</th>
									<th className="py-3 px-4 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/40">
								{filteredRecords.map((r) => {
									const isChecking = checkingRecords[r.id]
									const checkRes = checkResults[r.id]
									return (
										<tr key={r.id} className="hover:bg-muted/20 transition-colors">
											<td className="py-3 px-4">
												<span
													className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
														r.type === "A"
															? "bg-blue-500/15 text-blue-500"
															: r.type === "AAAA"
															? "bg-purple-500/15 text-purple-500"
															: r.type === "CNAME"
															? "bg-teal-500/15 text-teal-500"
															: r.type === "TXT"
															? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
															: r.type === "MX"
															? "bg-amber-500/15 text-amber-500"
															: "bg-muted text-muted-foreground"
													}`}
												>
													{r.type}
												</span>
											</td>
											<td className="py-3 px-4 font-mono text-xs font-medium text-foreground">
												{r.name}
											</td>
											<td className="py-3 px-4 font-mono text-xs text-muted-foreground max-w-xs truncate" title={r.content}>
												{r.content}
											</td>
											<td className="py-3 px-4">
												{r.proxied ? (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-500/15 text-orange-600 dark:text-orange-400">
														<Cloud className="h-3 w-3 fill-orange-500" />
														Proxied
													</span>
												) : (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
														<Cloud className="h-3 w-3 text-muted-foreground/60" />
														DNS Only
													</span>
												)}
											</td>
											<td className="py-3 px-4 text-xs text-muted-foreground">
												{r.ttl === 1 ? "Auto" : `${r.ttl}s`}
											</td>
											<td className="py-3 px-4">
												{checkRes ? (
													<div className="flex items-center gap-1.5 text-xs">
														{checkRes.status === "resolved" && (
															<span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
																<CheckCircle2 className="h-3.5 w-3.5" />
																Resolving ({checkRes.latencyMs}ms)
															</span>
														)}
														{checkRes.status === "mismatch" && (
															<span className="inline-flex items-center gap-1 text-amber-500 font-medium" title={checkRes.message}>
																<AlertCircle className="h-3.5 w-3.5" />
																Mismatch ({checkRes.latencyMs}ms)
															</span>
														)}
														{checkRes.status === "failed" && (
															<span className="inline-flex items-center gap-1 text-destructive font-medium" title={checkRes.message}>
																<XCircle className="h-3.5 w-3.5" />
																Failed
															</span>
														)}
													</div>
												) : (
													<Button
														variant="ghost"
														size="sm"
														className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
														onClick={() => checkRecordResolution(r)}
														disabled={isChecking}
													>
														{isChecking ? (
															<RefreshCw className="h-3 w-3 animate-spin mr-1" />
														) : (
															<Zap className="h-3 w-3 mr-1 text-muted-foreground" />
														)}
														Test DNS
													</Button>
												)}
											</td>
											<td className="py-3 px-4 text-right">
												<div className="flex items-center justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-foreground"
														onClick={() => openEditModal(r)}
													>
														<Edit className="h-3.5 w-3.5" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-destructive/80 hover:text-destructive"
														onClick={() => {
															setRecordToDelete(r)
															setDeleteOpen(true)
														}}
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

			{/* Add/Edit Modal */}
			<Dialog open={modalOpen} onOpenChange={setModalOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>{editingRecord ? "Edit DNS Record" : "Add DNS Record"}</DialogTitle>
						<DialogDescription>
							{editingRecord
								? `Updating record for ${editingRecord.name}`
								: "Configure a new DNS record in Cloudflare"}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<div className="grid grid-cols-3 gap-3">
							<div className="col-span-1 space-y-1.5">
								<Label className="text-xs">Type</Label>
								<select
									className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
									value={recordType}
									onChange={(e) => setRecordType(e.target.value)}
								>
									{["A", "AAAA", "CNAME", "TXT", "MX", "NS", "CAA", "SRV"].map((tp) => (
										<option key={tp} value={tp}>
											{tp}
										</option>
									))}
								</select>
							</div>

							<div className="col-span-2 space-y-1.5">
								<Label className="text-xs">Name / Host</Label>
								<Input
									placeholder="e.g. app or @"
									value={recordName}
									onChange={(e) => setRecordName(e.target.value)}
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs">
								Content / Value {recordType === "A" && "(IPv4 address)"}
								{recordType === "AAAA" && "(IPv6 address)"}
								{recordType === "CNAME" && "(Target domain)"}
							</Label>
							<Input
								placeholder={
									recordType === "A"
										? "192.0.2.1"
										: recordType === "CNAME"
										? "example.com"
										: "Content value"
								}
								value={recordContent}
								onChange={(e) => setRecordContent(e.target.value)}
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label className="text-xs">TTL</Label>
								<select
									className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
									value={recordTTL}
									onChange={(e) => setRecordTTL(Number(e.target.value))}
								>
									<option value={1}>Auto</option>
									<option value={60}>1 minute</option>
									<option value={300}>5 minutes</option>
									<option value={1800}>30 minutes</option>
									<option value={3600}>1 hour</option>
									<option value={86400}>1 day</option>
								</select>
							</div>

							{(recordType === "A" || recordType === "AAAA" || recordType === "CNAME") && (
								<div className="space-y-1.5 flex flex-col justify-end pb-1">
									<div className="flex items-center justify-between">
										<Label className="text-xs cursor-pointer">Proxy status</Label>
										<Switch checked={recordProxied} onCheckedChange={setRecordProxied} />
									</div>
									<span className="text-[10px] text-muted-foreground">
										{recordProxied ? "Orange Cloud (CDN & WAF)" : "Gray Cloud (DNS only)"}
									</span>
								</div>
							)}
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs">Comment (Optional)</Label>
							<Input
								placeholder="e.g. Internal API server"
								value={recordComment}
								onChange={(e) => setRecordComment(e.target.value)}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setModalOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveRecord} disabled={saving || !recordName || !recordContent}>
							{saving ? "Saving..." : editingRecord ? "Update Record" : "Create Record"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Delete DNS Record</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete <span className="font-mono font-semibold text-foreground">{recordToDelete?.name}</span>? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteOpen(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteRecord} disabled={deleting}>
							{deleting ? "Deleting..." : "Delete Record"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
