/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: html comes directly from docker via agent */
import { t } from "@lingui/core/macro"
import { Trans } from "@lingui/react/macro"
import {
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type Row,
	type SortingState,
	type Table as TableType,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table"
import { memo, type RefObject, useEffect, useRef, useState } from "react"
import { DataTablePagination, usePagination } from "@/components/ui/data-table-pagination"
import { Input } from "@/components/ui/input"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { pb } from "@/lib/api"
import type { ContainerRecord } from "@/types"
import { containerChartCols } from "@/components/containers-table/containers-table-columns"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ContainerHealth, ContainerHealthLabels } from "@/lib/enums"
import { cn, useBrowserStorage } from "@/lib/utils"
import { Sheet, SheetTitle, SheetHeader, SheetContent, SheetDescription } from "../ui/sheet"
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog"
import { Button } from "@/components/ui/button"
import { $allSystemsById } from "@/lib/stores"
import { LoaderCircleIcon, MaximizeIcon, RefreshCwIcon, XIcon, PlayIcon, SquareIcon, RotateCwIcon } from "lucide-react"
import { Separator } from "../ui/separator"
import { $router, Link } from "../router"
import { listenKeys } from "nanostores"
import { getPagePath } from "@nanostores/router"
import { LogsDisplay, LogsFullscreenDialog, LogsIconButton, LogsTimestampToggle } from "@/components/logs-display"
import { getLogTimestampDecorations } from "@/lib/logs"

const syntaxTheme = "github-dark-dimmed"

export default function ContainersTable({ systemId }: { systemId?: string }) {
	const loadTime = Date.now()
	const [data, setData] = useState<ContainerRecord[] | undefined>(undefined)
	const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
	const [sorting, setSorting] = useBrowserStorage<SortingState>(
		`sort-c-${systemId ? 1 : 0}`,
		[{ id: systemId && systemId !== "all" ? "name" : "system", desc: false }],
		sessionStorage
	)
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

	// Hide ports column if no ports are present
	useEffect(() => {
		if (data) {
			const hasPorts = data.some((container) => container.ports)
			setColumnVisibility((prev) => {
				if (prev.ports === hasPorts) {
					return prev
				}
				return { ...prev, ports: hasPorts }
			})
		}
	}, [data])

	const [rowSelection, setRowSelection] = useState({})
	const [globalFilter, setGlobalFilter] = useState("")
	const { pagination, onPaginationChange, resetPageIndex } = usePagination()

	const handleAction = async (container: ContainerRecord, action: "restart" | "start" | "stop") => {
		setActionLoading((prev) => ({ ...prev, [container.id]: true }))
		try {
			await pb.send("/api/beszel/containers/action", {
				method: "POST",
				body: {
					system: container.system,
					container: container.id,
					action,
				},
			})
			setData((cur) =>
				cur?.map((c) => {
					if (c.id === container.id) {
						return {
							...c,
							status: action === "restart" ? "Up (restarting...)" : action === "start" ? "Up" : "Exited",
						}
					}
					return c
				})
			)
			setTimeout(() => {
				fetchData(systemId)
			}, 1500)
		} catch (err: any) {
			alert(`Action '${action}' failed: ${err.message || err}`)
		} finally {
			setActionLoading((prev) => ({ ...prev, [container.id]: false }))
		}
	}

	const fetchData = async (sysId?: string) => {
		const isLocalOnly = sysId === "local"
		const isRemoteOnly = sysId && sysId !== "all" && sysId !== "local"

		let remoteItems: ContainerRecord[] = []
		let localItems: ContainerRecord[] = []

		if (!isLocalOnly) {
			try {
				const res = await pb.collection<ContainerRecord>("containers").getList(0, 2000, {
					fields: "id,name,image,updatable,ports,cpu,memory,net,health,status,system,updated",
					filter: isRemoteOnly ? pb.filter("system={:system}", { system: sysId }) : undefined,
				})
				remoteItems = res.items || []
			} catch (err) {
				console.error("Failed to fetch remote containers", err)
			}
		}

		if (!isRemoteOnly) {
			try {
				const localRes = await pb.send<any[]>("/api/dockmon/docker/containers", {})
				if (Array.isArray(localRes)) {
					localItems = localRes.map((c: any) => {
						const isRunning = c.State === "running"
						const isPaused = c.State === "paused"
						const statusText = c.Status || (isRunning ? "Up" : isPaused ? "Paused" : "Exited")
						const portStr = (c.Ports || [])
							.map((p: any) => (p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}/${p.Type}`))
							.join(", ")

						return {
							id: c.Id,
							system: "local",
							name: (c.Names?.[0] || c.Id.slice(0, 12)).replace(/^\//, ""),
							image: c.Image || "",
							ports: portStr,
							cpu: 0,
							memory: 0,
							net: 0,
							health: (c.Status || "").toLowerCase().includes("healthy") ? 1 : 0,
							status: statusText,
							updated: Date.now(),
						} as ContainerRecord
					})
				}
			} catch (_) {
				// Local Docker may be inactive or unavailable
			}
		}

		setData([...remoteItems, ...localItems])
	}

	useEffect(() => {
		// initial load
		fetchData(systemId)

		// periodic refresh
		const timer = setInterval(() => fetchData(systemId), 15000)

		// if no systemId, pull system containers after every system update
		if (!systemId || systemId === "all") {
			const unsubscribe = $allSystemsById.listen((_value, _oldValue, _changedSystemId) => {
				if (Date.now() - loadTime > 500) {
					fetchData(systemId)
				}
			})
			return () => {
				unsubscribe()
				clearInterval(timer)
			}
		}

		if (systemId === "local") {
			return () => clearInterval(timer)
		}

		// if systemId, fetch containers after the system is updated
		const unsubscribeKeys = listenKeys($allSystemsById, [systemId], (_newSystems) => {
			fetchData(systemId)
		})

		return () => {
			unsubscribeKeys()
			clearInterval(timer)
		}
	}, [systemId])

	const table = useReactTable({
		data: data ?? [],
		columns: containerChartCols.filter((col) => (systemId && systemId !== "all" ? col.id !== "system" : true)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		autoResetPageIndex: false,
		onPaginationChange,
		onSortingChange: (updater) => {
			setSorting(updater)
			resetPageIndex()
		},
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		defaultColumn: {
			sortUndefined: "last",
			size: 100,
			minSize: 0,
		},
		meta: {
			onAction: handleAction,
			actionLoading,
		},
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			globalFilter,
			pagination,
		},
		onGlobalFilterChange: (value) => {
			setGlobalFilter(value)
			resetPageIndex()
		},
		globalFilterFn: (row, _columnId, filterValue) => {
			const container = row.original
			const systemName = $allSystemsById.get()[container.system]?.name ?? ""
			const id = container.id ?? ""
			const name = container.name ?? ""
			const status = container.status ?? ""
			const healthLabel = ContainerHealthLabels[container.health as ContainerHealth] ?? ""
			const image = container.image ?? ""
			const ports = container.ports ?? ""
			const searchString = `${systemName} ${id} ${name} ${healthLabel} ${status} ${image} ${ports}`.toLowerCase()

			return (filterValue as string)
				.toLowerCase()
				.split(" ")
				.every((term) => searchString.includes(term))
		},
	})

	const rows = table.getRowModel().rows
	const visibleColumns = table.getVisibleLeafColumns()

	return (
		<Card className="@container w-full px-3 py-5 sm:py-6 sm:px-6">
			<CardHeader className="p-0 mb-3 sm:mb-4">
				<div className="grid md:flex gap-x-5 gap-y-3 w-full items-end">
					<div className="px-2 sm:px-1">
						<CardTitle className="mb-2">
							<Trans>All Containers</Trans>
						</CardTitle>
						<CardDescription className="flex">
							<Trans>Click on a container to view more information.</Trans>
						</CardDescription>
					</div>
					<div className="relative ms-auto w-full max-w-full md:w-64">
						<Input
							placeholder={t`Filter...`}
							value={globalFilter}
							onChange={(e) => table.setGlobalFilter(e.target.value)}
							className="ps-4 pe-10 w-full"
						/>
						{globalFilter && (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={t`Clear`}
								className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
								onClick={() => table.setGlobalFilter("")}
							>
								<XIcon className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</CardHeader>
			<div className="rounded-md">
				<AllContainersTable table={table} rows={rows} colLength={visibleColumns.length} data={data} />
			</div>
			<DataTablePagination table={table} showSelected={false} />
		</Card>
	)
}

const AllContainersTable = memo(function AllContainersTable({
	table,
	rows,
	colLength,
	data,
}: {
	table: TableType<ContainerRecord>
	rows: Row<ContainerRecord>[]
	colLength: number
	data: ContainerRecord[] | undefined
}) {
	const activeContainer = useRef<ContainerRecord | null>(null)
	const [sheetOpen, setSheetOpen] = useState(false)
	const openSheet = (container: ContainerRecord) => {
		activeContainer.current = container
		setSheetOpen(true)
	}
	const meta = table.options.meta as
		| {
				onAction?: (container: ContainerRecord, action: "restart" | "start" | "stop") => Promise<void>
		  }
		| undefined

	return (
		<div className="max-w-full relative overflow-auto border rounded-md">
			<table className="text-sm w-full h-full text-nowrap">
				<ContainersTableHead table={table} />
				<TableBody>
					{rows.length ? (
						rows.map((row) => <ContainerTableRow key={row.id} row={row} openSheet={openSheet} />)
					) : (
						<TableRow>
							<TableCell colSpan={colLength} className="h-37 text-center pointer-events-none">
								{data ? (
									<Trans>No results.</Trans>
								) : (
									<LoaderCircleIcon className="animate-spin size-10 opacity-60 mx-auto" />
								)}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</table>
			<ContainerSheet
				sheetOpen={sheetOpen}
				setSheetOpen={setSheetOpen}
				activeContainer={activeContainer}
				onAction={meta?.onAction}
			/>
		</div>
	)
})

async function getLogsHtml(container: ContainerRecord): Promise<string> {
	try {
		const [{ highlighter }, logsHtml] = await Promise.all([
			import("@/lib/shiki"),
			pb.send<{ logs: string }>("/api/beszel/containers/logs", {
				system: container.system,
				container: container.id,
			}),
		])
		return logsHtml.logs
			? highlighter.codeToHtml(logsHtml.logs, {
					lang: "log",
					theme: syntaxTheme,
					decorations: getLogTimestampDecorations(logsHtml.logs),
				})
			: t`No results.`
	} catch (error) {
		console.error(error)
		return ""
	}
}

async function getInfoHtml(container: ContainerRecord): Promise<string> {
	try {
		let [{ highlighter }, { info }] = await Promise.all([
			import("@/lib/shiki"),
			pb.send<{ info: string }>("/api/beszel/containers/info", {
				system: container.system,
				container: container.id,
			}),
		])
		try {
			info = JSON.stringify(JSON.parse(info), null, 2)
		} catch (_) {}
		return info ? highlighter.codeToHtml(info, { lang: "json", theme: syntaxTheme }) : t`No results.`
	} catch (error) {
		console.error(error)
		return ""
	}
}

function ContainerSheet({
	sheetOpen,
	setSheetOpen,
	activeContainer,
	onAction,
}: {
	sheetOpen: boolean
	setSheetOpen: (open: boolean) => void
	activeContainer: RefObject<ContainerRecord | null>
	onAction?: (container: ContainerRecord, action: "restart" | "start" | "stop") => Promise<void>
}) {
	const [logsDisplay, setLogsDisplay] = useState<string>("")
	const [infoDisplay, setInfoDisplay] = useState<string>("")
	const [logsFullscreenOpen, setLogsFullscreenOpen] = useState<boolean>(false)
	const [infoFullscreenOpen, setInfoFullscreenOpen] = useState<boolean>(false)
	const [isRefreshingLogs, setIsRefreshingLogs] = useState<boolean>(false)
	const [sheetActionLoading, setSheetActionLoading] = useState<string | null>(null)
	const [sheetActionMsg, setSheetActionMsg] = useState<string | null>(null)
	const logsContainerRef = useRef<HTMLDivElement>(null)

	const container = activeContainer.current

	function scrollLogsToBottom() {
		if (logsContainerRef.current) {
			logsContainerRef.current.scrollTo({ top: logsContainerRef.current.scrollHeight })
		}
	}

	const refreshLogs = async () => {
		if (!container) return
		setIsRefreshingLogs(true)
		const startTime = Date.now()

		try {
			const logsHtml = await getLogsHtml(container)
			setLogsDisplay(logsHtml)
			setTimeout(scrollLogsToBottom, 20)
		} catch (error) {
			console.error(error)
		} finally {
			// Ensure minimum spin duration of 800ms
			const elapsed = Date.now() - startTime
			const remaining = Math.max(0, 500 - elapsed)
			setTimeout(() => {
				setIsRefreshingLogs(false)
			}, remaining)
		}
	}

	const handleSheetAction = async (action: "restart" | "start" | "stop") => {
		if (!container) return
		setSheetActionLoading(action)
		setSheetActionMsg(null)
		try {
			if (onAction) {
				await onAction(container, action)
			} else {
				await pb.send("/api/beszel/containers/action", {
					method: "POST",
					body: {
						system: container.system,
						container: container.id,
						action,
					},
				})
			}
			setSheetActionMsg(t`Action completed`)
			setTimeout(() => {
				refreshLogs()
			}, 1000)
		} catch (err: any) {
			setSheetActionMsg(`Error: ${err.message || err}`)
		} finally {
			setSheetActionLoading(null)
		}
	}

	useEffect(() => {
		setLogsDisplay("")
		setInfoDisplay("")
		setSheetActionMsg(null)
		if (!container) return
		;(async () => {
			const [logsHtml, infoHtml] = await Promise.all([getLogsHtml(container), getInfoHtml(container)])
			setLogsDisplay(logsHtml)
			setInfoDisplay(infoHtml)
			setTimeout(scrollLogsToBottom, 20)
		})()
	}, [container])

	if (!container) return null

	const isRunning = (container.status || "").toLowerCase().startsWith("up")

	return (
		<>
			<LogsFullscreenDialog
				open={logsFullscreenOpen}
				onOpenChange={setLogsFullscreenOpen}
				logsDisplay={logsDisplay}
				name={container.name}
				onRefresh={refreshLogs}
				isRefreshing={isRefreshingLogs}
			/>
			<InfoFullscreenDialog
				open={infoFullscreenOpen}
				onOpenChange={setInfoFullscreenOpen}
				infoDisplay={infoDisplay}
				containerName={container.name}
			/>
			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent className="w-full sm:max-w-220 p-2">
					<SheetHeader>
						<SheetTitle>{container.name}</SheetTitle>
						<SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<Link className="hover:underline" href={getPagePath($router, "system", { id: container.system })}>
								{$allSystemsById.get()[container.system]?.name ?? (container.system === "local" ? t`Local Docker` : container.system)}
							</Link>
							<Separator orientation="vertical" className="h-2.5 bg-muted-foreground opacity-70" />
							{container.status}
							<Separator orientation="vertical" className="h-2.5 bg-muted-foreground opacity-70" />
							{container.image}
							<Separator orientation="vertical" className="h-2.5 bg-muted-foreground opacity-70" />
							{container.id.slice(0, 12)}
						</SheetDescription>
					</SheetHeader>

					{/* Container Lifecycle Control Bar */}
					<div className="flex flex-wrap items-center gap-2 mx-3 my-2 p-2 rounded-lg border bg-card/60 backdrop-blur">
						<span className="text-xs font-semibold text-muted-foreground mr-1">{t`Control`}:</span>
						{isRunning ? (
							<>
								<Button
									variant="outline"
									size="sm"
									className="h-7 text-xs gap-1.5 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
									disabled={!!sheetActionLoading}
									onClick={() => handleSheetAction("restart")}
								>
									<RotateCwIcon className={cn("size-3.5", sheetActionLoading === "restart" && "animate-spin")} />
									{t`Restart`}
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="h-7 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
									disabled={!!sheetActionLoading}
									onClick={() => handleSheetAction("stop")}
								>
									<SquareIcon className={cn("size-3.5", sheetActionLoading === "stop" && "animate-spin")} />
									{t`Stop`}
								</Button>
							</>
						) : (
							<Button
								variant="outline"
								size="sm"
								className="h-7 text-xs gap-1.5 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
								disabled={!!sheetActionLoading}
								onClick={() => handleSheetAction("start")}
							>
								<PlayIcon className={cn("size-3.5", sheetActionLoading === "start" && "animate-spin")} />
								{t`Start`}
							</Button>
						)}
						{sheetActionMsg && (
							<span className="text-xs font-medium text-muted-foreground ml-auto truncate max-w-[220px]" title={sheetActionMsg}>
								{sheetActionMsg}
							</span>
						)}
					</div>
					<div className="px-3 pb-3 -mt-4 flex flex-col gap-3 h-full items-start">
						<div className="flex items-center w-full">
							<h3>{t`Logs`}</h3>
							<LogsTimestampToggle className="ms-auto" />
							<LogsIconButton label={t`Refresh`} onClick={refreshLogs} disabled={isRefreshingLogs}>
								<RefreshCwIcon
									className={`size-4 transition-transform duration-300 ${isRefreshingLogs ? "animate-spin" : ""}`}
								/>
							</LogsIconButton>
							<LogsIconButton label={t`Fullscreen`} onClick={() => setLogsFullscreenOpen(true)}>
								<MaximizeIcon className="size-4" />
							</LogsIconButton>
						</div>
						<LogsDisplay logsDisplay={logsDisplay} containerRef={logsContainerRef} />
						<div className="flex items-center w-full">
							<h3>{t`Detail`}</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setInfoFullscreenOpen(true)}
								className="h-8 w-8 p-0 ms-auto"
							>
								<MaximizeIcon className="size-4" />
							</Button>
						</div>
						<div
							className={cn(
								"grow h-[calc(50dvh-4rem)] w-full overflow-auto p-3 rounded-md bg-gh-dark text-white text-sm",
								!infoDisplay && "animate-pulse"
							)}
						>
							<div dangerouslySetInnerHTML={{ __html: infoDisplay }} />
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</>
	)
}

function ContainersTableHead({ table }: { table: TableType<ContainerRecord> }) {
	return (
		<TableHeader className="sticky top-0 z-50 w-full border-b-2">
			{table.getHeaderGroups().map((headerGroup) => (
				<tr key={headerGroup.id}>
					{headerGroup.headers.map((header) => {
						return (
							<TableHead className="px-2" key={header.id} style={{ width: header.getSize() }}>
								{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
							</TableHead>
						)
					})}
				</tr>
			))}
		</TableHeader>
	)
}

const ContainerTableRow = memo(function ContainerTableRow({
	row,
	openSheet,
}: {
	row: Row<ContainerRecord>
	openSheet: (container: ContainerRecord) => void
}) {
	return (
		<TableRow
			data-state={row.getIsSelected() && "selected"}
			className="cursor-pointer transition-opacity"
			onClick={() => openSheet(row.original)}
		>
			{row.getVisibleCells().map((cell) => (
				<TableCell
					key={cell.id}
					className="py-0 ps-4.5"
					style={{
						height: 54,
						width: cell.column.getSize(),
					}}
				>
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</TableCell>
			))}
		</TableRow>
	)
})

function InfoFullscreenDialog({
	open,
	onOpenChange,
	infoDisplay,
	containerName,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	infoDisplay: string
	containerName: string
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[calc(100vw-20px)] h-[calc(100dvh-20px)] max-w-none p-0 bg-gh-dark border-0 text-white">
				<DialogTitle className="sr-only">{containerName} info</DialogTitle>
				<div className="flex-1 overflow-auto">
					<div className="h-full w-full overflow-auto p-3 rounded-md bg-gh-dark text-sm leading-relaxed">
						<div dangerouslySetInnerHTML={{ __html: infoDisplay }} />
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
