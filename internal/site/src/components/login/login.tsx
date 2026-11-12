import { t } from "@lingui/core/macro"
import { useStore } from "@nanostores/react"
import { useEffect, useMemo, useState } from "react"
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
		<div className="min-h-[100dvh] flex flex-col justify-between bg-background text-foreground">
			{/* Top Bar: Quiet, clean chrome */}
			<header className="w-full px-6 py-4 flex items-center justify-between border-b border-border/40">
				<div className="flex items-center gap-2">
					<Logo className="h-6" />
				</div>
				<div className="flex items-center gap-3">
					<span className="text-xs text-muted-foreground font-mono">
						v0.21.1
					</span>
					<div className="border border-border/60 rounded-md p-0.5">
						<ModeToggle />
					</div>
				</div>
			</header>

			{/* Center: Deliberate, calm login card */}
			<main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
				<div className="w-full max-w-[380px] rounded-2xl border border-border/80 bg-card p-7 sm:p-8 space-y-6 shadow-sm">
					{/* Card Header */}
					<div className="text-center space-y-1.5">
						<h1 className="text-xl font-semibold tracking-tight text-foreground">
							{isFirstRun ? "Create admin account" : "Sign in to DockMon"}
						</h1>
						<p className="text-xs text-muted-foreground">
							{subtitle}
						</p>
					</div>

					{/* Form */}
					<div>
						{page?.route === "forgot_password" ? (
							<ForgotPassword />
						) : page?.route === "request_otp" ? (
							<OtpRequestForm />
						) : (
							<UserAuthForm isFirstRun={isFirstRun} authMethods={login.authMethods} />
						)}
					</div>
				</div>
			</main>

			{/* Footer: Quiet baseline */}
			<footer className="w-full px-6 py-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
				<div className="flex items-center gap-1.5">
					<span>DockMon</span>
					<span>•</span>
					<span>Server &amp; Docker Monitoring</span>
				</div>
				<div className="text-xs text-muted-foreground">
					Self-hosted
				</div>
			</footer>
		</div>
	)
}
