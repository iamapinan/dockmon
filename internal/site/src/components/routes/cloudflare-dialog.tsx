import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { pb } from "@/lib/api"
import { Cloud, CheckCircle2, AlertCircle, RefreshCw, DownloadCloud } from "lucide-react"

interface CloudflareDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onImportSuccess: () => void
}

interface CFDomainRecord {
	name: string
	proxied: boolean
	type: string
}

export function CloudflareDialog({ open, onOpenChange, onImportSuccess }: CloudflareDialogProps) {
	const [token, setToken] = useState("")
	const [verifying, setVerifying] = useState(false)
	const [verified, setVerified] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [loadingZones, setLoadingZones] = useState(false)
	const [domains, setDomains] = useState<CFDomainRecord[]>([])
	const [selected, setSelected] = useState<Record<string, boolean>>({})
	const [importing, setImporting] = useState(false)

	const verifyToken = async () => {
		if (!token) return
		setVerifying(true)
		setError(null)
		try {
			const res = await pb.send<{ valid: boolean; error?: string }>("/api/dockmon/cloudflare/verify", {
				method: "POST",
				body: { apiToken: token },
			})
			if (res.valid) {
				setVerified(true)
				fetchZones()
			} else {
				setError(res.error || "Token is invalid")
			}
		} catch (err: any) {
			setError(err.message || "Failed to verify token")
		} finally {
			setVerifying(false)
		}
	}

	const fetchZones = async () => {
		setLoadingZones(true)
		setError(null)
		try {
			const res = await pb.send<{ result?: Array<{ name: string; id: string }> }>("/api/dockmon/cloudflare/zones", {})
			if (res.result && Array.isArray(res.result)) {
				const list: CFDomainRecord[] = []
				const selMap: Record<string, boolean> = {}
				for (const zone of res.result) {
					list.push({
						name: zone.name,
						proxied: true,
						type: "ZONE",
					})
					selMap[zone.name] = true
				}
				setDomains(list)
				setSelected(selMap)
			}
		} catch (err: any) {
			setError(err.message || "Failed to fetch Cloudflare zones")
		} finally {
			setLoadingZones(false)
		}
	}

	const handleImport = async () => {
		const toImport = domains.filter((d) => selected[d.name])
		if (toImport.length === 0) return

		setImporting(true)
		try {
			await pb.send("/api/dockmon/cloudflare/import", {
				method: "POST",
				body: { domains: toImport },
			})
			onImportSuccess()
			onOpenChange(false)
		} catch (err: any) {
			setError(err.message || "Failed to import domains")
		} finally {
			setImporting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Cloud className="h-5 w-5 text-amber-500" />
						Cloudflare Connect
					</DialogTitle>
					<DialogDescription>
						Connect your Cloudflare account to automatically discover, monitor, and sync domains and tunnels.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<Label htmlFor="cf-token">Cloudflare API Token</Label>
						<div className="flex gap-2">
							<Input
								id="cf-token"
								type="password"
								placeholder="Paste Cloudflare API Token (Zone.Read)"
								value={token}
								onChange={(e) => setToken(e.target.value)}
							/>
							<Button onClick={verifyToken} disabled={verifying || !token} variant="outline">
								{verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Verify"}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Requires an API Token with <code>Zone.Zone:Read</code> and <code>Zone.DNS:Read</code> permissions.
						</p>
					</div>

					{error && (
						<div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-500/10 rounded-md">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{verified && (
						<div className="flex items-center gap-2 p-2.5 text-sm text-green-500 bg-green-500/10 rounded-md">
							<CheckCircle2 className="h-4 w-4" />
							<span>Cloudflare API Token verified and active</span>
						</div>
					)}

					{loadingZones && (
						<div className="flex items-center justify-center p-6 gap-2 text-sm text-muted-foreground">
							<RefreshCw className="h-4 w-4 animate-spin" />
							<span>Fetching zones and domains from Cloudflare...</span>
						</div>
					)}

					{domains.length > 0 && (
						<div className="space-y-2">
							<div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
								<span>DISCOVERED DOMAINS ({domains.length})</span>
								<button
									type="button"
									className="text-primary hover:underline cursor-pointer"
									onClick={() => {
										const allSelected = Object.values(selected).every(Boolean)
										const next: Record<string, boolean> = {}
										for (const d of domains) next[d.name] = !allSelected
										setSelected(next)
									}}
								>
									Toggle all
								</button>
							</div>

							<div className="max-h-56 overflow-y-auto space-y-1.5 p-1 border rounded-md">
								{domains.map((d) => (
									<label
										key={d.name}
										className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
									>
										<div className="flex items-center gap-2.5">
											<Checkbox
												checked={!!selected[d.name]}
												onCheckedChange={(checked) =>
													setSelected((prev) => ({ ...prev, [d.name]: !!checked }))
												}
											/>
											<span className="font-medium">{d.name}</span>
										</div>
										<span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 font-mono">
											Cloudflare
										</span>
									</label>
								))}
							</div>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
					{domains.length > 0 && (
						<Button onClick={handleImport} disabled={importing} className="gap-2">
							{importing ? (
								<RefreshCw className="h-4 w-4 animate-spin" />
							) : (
								<DownloadCloud className="h-4 w-4" />
							)}
							Import Selected
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
