import { t } from "@lingui/core/macro"
import { useStore } from "@nanostores/react"
import { useEffect, useMemo, useState } from "react"
import {
	Activity,
	Boxes,
	Cloud,
	Server,
	ShieldCheck,
	Zap,
} from "lucide-react"
import { UserAuthForm } from "@/components/login/auth-form"
import { pb } from "@/lib/api"
import { $authenticated } from "@/lib/stores"
import { Logo } from "../logo"
import { ModeToggle } from "../mode-toggle"
import { $router } from "../router"
import ForgotPassword from "./forgot-pass-form"
import { loadLogin } from "./load-login"
import { OtpRequestForm } from "./otp-forms"

export default function () {
	const page = useStore($router)
	const [login, setLogin] = useState<Awaited<ReturnType<typeof loadLogin>>>()
	const isFirstRun = login?.firstRun ?? false

	useEffect(() => {
		const controller = new AbortController()
		const autoLogin = !!globalThis.BESZEL.AUTO_LOGIN
		document.title = autoLogin ? "DockMon" : `${t`Login`} / DockMon`
		loadLogin(
			pb,
			{
				route: $router.get()?.route,
				search: window.location.search,
				loggedOut: !!sessionStorage.getItem("lo"),
				autoLogin,
			},
			controller.signal
		)
			.then((result) => {
				if (controller.signal.aborted) return
				if (result.authenticated) {
					$authenticated.set(true)
					return
				}
				document.title = `${t`Login`} / DockMon`
				setLogin(result)
			})
			.catch((error) => {
				if (!controller.signal.aborted) console.error(error)
			})
		return () => controller.abort()
	}, [])

	const subtitle = useMemo(() => {
		if (isFirstRun) {
			return t`Please create an admin account`
		} else if (page?.route === "forgot_password") {
			return t`Enter email address to reset password`
		} else if (page?.route === "request_otp") {
			return t`Request a one-time password`
		} else {
			return t`Please sign in to your account`
		}
	}, [isFirstRun, page])

	if (!login) {
		return null
	}

	return (
		<div className="min-h-[100dvh] flex flex-col justify-between bg-background text-foreground relative overflow-hidden select-none">
			{/* Ambient Technical Background Grid & Radial Glow */}
			<div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--foreground)/0.035)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.035)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,black_40%,transparent_100%)] pointer-events-none" />
			<div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-500/15 via-teal-500/10 to-transparent blur-3xl pointer-events-none" />
			<div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-gradient-to-t from-emerald-500/10 to-transparent blur-3xl pointer-events-none" />

			{/* Top Bar Navigation / Utility */}
			<header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-border/40 backdrop-blur-md bg-background/50">
				<div className="flex items-center gap-3">
					<Logo className="h-6" />
					<span className="hidden sm:inline-flex items-center text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50">
						Cloud &amp; Edge
					</span>
				</div>

				<div className="flex items-center gap-3">
					{/* Live telemetry status beacon */}
					<div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm">
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
						</span>
						<span className="font-semibold">NODES ONLINE</span>
					</div>

					<div className="bg-card/80 border border-border/60 rounded-lg p-0.5 shadow-sm">
						<ModeToggle />
					</div>
				</div>
			</header>

			{/* Main Workspace: Showcase + Authentication Card */}
			<main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 my-auto">
				<div className="w-full max-w-6xl mx-auto grid lg:grid-cols-12 gap-8 lg:gap-14 items-center">
					{/* Left Telemetry Showcase Column (visible on desktop) */}
					<div className="hidden lg:flex lg:col-span-7 flex-col space-y-7 pr-4">
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border border-blue-500/20 bg-blue-500/10 text-blue-500 self-start shadow-sm">
							<Zap className="h-3.5 w-3.5" />
							Next-Gen Server &amp; Container Orchestration
						</div>

						<div className="space-y-3">
							<h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.12] text-foreground">
								Full-stack visibility across{" "}
								<span className="bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
									every server &amp; container.
								</span>
							</h1>
							<p className="text-base text-muted-foreground leading-relaxed max-w-[55ch]">
								High-frequency system metrics, Docker container lifecycle controls, Cloudflare DNS synchronization, and zero-trust telemetry alerts in one unified dashboard.
							</p>
						</div>

						{/* 3 Tech Feature Cards */}
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
							<div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-2 hover:border-primary/40 transition-all shadow-sm">
								<div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
									<Boxes className="h-4 w-4" />
								</div>
								<h2 className="font-bold text-sm text-foreground">Docker Lifecycle</h2>
								<p className="text-xs text-muted-foreground leading-relaxed">
									Start, stop, restart, inspect, and stream syntax logs on any remote node.
								</p>
							</div>

							<div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-2 hover:border-primary/40 transition-all shadow-sm">
								<div className="h-9 w-9 rounded-lg bg-teal-500/10 text-teal-500 flex items-center justify-center">
									<Activity className="h-4 w-4" />
								</div>
								<h2 className="font-bold text-sm text-foreground">Precision Telemetry</h2>
								<p className="text-xs text-muted-foreground leading-relaxed">
									Sub-second CPU, RAM, disk I/O and network graphs with ultra-light agent.
								</p>
							</div>

							<div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-2 hover:border-primary/40 transition-all shadow-sm">
								<div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
									<Cloud className="h-4 w-4" />
								</div>
								<h2 className="font-bold text-sm text-foreground">Edge &amp; Domains</h2>
								<p className="text-xs text-muted-foreground leading-relaxed">
									Cloudflare zone synchronization and per-host reverse proxy domain matching.
								</p>
							</div>
						</div>

						{/* Live Agent Terminal Badge */}
						<div className="rounded-xl border border-border/60 bg-muted/40 backdrop-blur p-3.5 px-4 font-mono text-xs text-muted-foreground flex items-center justify-between shadow-inner">
							<div className="flex items-center gap-2">
								<Server className="h-3.5 w-3.5 text-primary" />
								<span>Zero-Trust WebSocket &amp; SSH Agent Transport</span>
							</div>
							<div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-[11px]">
								<ShieldCheck className="h-3.5 w-3.5" />
								<span>TLS Verified</span>
							</div>
						</div>
					</div>

					{/* Right Login Card Column */}
					<div className="w-full max-w-[420px] mx-auto lg:col-span-5">
						<div className="relative rounded-2xl border border-border/80 bg-card/90 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden">
							{/* Top Accent Gradient Line */}
							<div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400" />

							{/* Card Header */}
							<div className="text-center space-y-2">
								<Logo className="h-8 justify-center mx-auto" />
								<p className="text-xs sm:text-sm font-medium text-muted-foreground pt-1">{subtitle}</p>
							</div>

							{/* Auth Form / Route */}
							<div className="pt-1">
								{page?.route === "forgot_password" ? (
									<ForgotPassword />
								) : page?.route === "request_otp" ? (
									<OtpRequestForm />
								) : (
									<UserAuthForm isFirstRun={isFirstRun} authMethods={login.authMethods} />
								)}
							</div>
						</div>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="relative z-10 w-full px-6 py-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 backdrop-blur-md bg-background/40">
				<div className="flex items-center gap-1.5 font-mono">
					<span>DockMon</span>
					<span>•</span>
					<span>v0.21.1</span>
				</div>
				<div className="text-[11px] opacity-80">
					Multi-Server Docker &amp; Cloud Telemetry
				</div>
			</footer>
		</div>
	)
}
