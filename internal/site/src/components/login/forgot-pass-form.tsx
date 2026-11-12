import { t } from "@lingui/core/macro"
import { Trans } from "@lingui/react/macro"
import { getPagePath } from "@nanostores/router"
import { ArrowLeft, LoaderCircle, MailIcon, SendHorizonalIcon } from "lucide-react"
import { useCallback, useState } from "react"
import { pb } from "@/lib/api"
import { $router, Link } from "../router"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { toast } from "../ui/use-toast"

const showLoginFaliedToast = () => {
	toast({
		title: t`Login attempt failed`,
		description: t`Please check your credentials and try again`,
		variant: "destructive",
	})
}

export default function ForgotPassword() {
	const [isLoading, setIsLoading] = useState<boolean>(false)
	const [email, setEmail] = useState("")

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()
			setIsLoading(true)
			try {
				await pb.collection("users").requestPasswordReset(email)
				toast({
					title: t`Password reset request received`,
					description: t`Check ${email} for a reset link.`,
				})
			} catch (e) {
				showLoginFaliedToast()
			} finally {
				setIsLoading(false)
				setEmail("")
			}
		},
		[email]
	)

	return (
		<div className="space-y-4">
			<form onSubmit={handleSubmit}>
				<div className="grid gap-3">
					<div className="grid gap-1.5 relative">
						<MailIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
						<Label className="sr-only" htmlFor="email">
							<Trans>Email</Trans>
						</Label>
						<Input
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							id="email"
							name="email"
							required
							placeholder="name@example.com"
							type="email"
							autoCapitalize="none"
							autoComplete="email"
							autoCorrect="off"
							disabled={isLoading}
							className="ps-10 h-11 rounded-lg bg-muted/30 hover:bg-muted/50 focus:bg-background border-border/80 focus:border-primary transition-all text-sm"
						/>
					</div>
					<button
						className="h-11 w-full rounded-lg font-semibold text-sm flex items-center justify-center bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 hover:from-blue-500 hover:via-teal-500 hover:to-emerald-500 text-white shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-60"
						disabled={isLoading}
					>
						{isLoading ? (
							<LoaderCircle className="me-2 h-4 w-4 animate-spin" />
						) : (
							<SendHorizonalIcon className="me-2 h-4 w-4" />
						)}
						<Trans>Reset Password</Trans>
					</button>
				</div>
			</form>

			<div className="flex flex-col items-center gap-2 pt-1">
				<Dialog>
					<DialogTrigger asChild>
						<button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 opacity-75 hover:opacity-100 transition-opacity">
							<Trans>Command line instructions</Trans>
						</button>
					</DialogTrigger>
					<DialogContent className="max-w-[41em]">
						<DialogHeader>
							<DialogTitle>
								<Trans>Command line instructions</Trans>
							</DialogTitle>
						</DialogHeader>
						<p className="text-primary/70 text-[0.95em] leading-relaxed">
							<Trans>
								If you've lost the password to your admin account, you may reset it using the following command.
							</Trans>
						</p>
						<p className="text-primary/70 text-[0.95em] leading-relaxed">
							<Trans>Then log into the backend and reset your user account password in the users table.</Trans>
						</p>
						<code className="bg-muted rounded-md py-1.5 px-3 me-auto text-xs font-mono select-all block">
							./dockmon superuser upsert user@example.com password
						</code>
						<code className="bg-muted rounded-md py-1.5 px-3 me-auto text-xs font-mono select-all block">
							docker exec dockmon /dockmon superuser upsert name@example.com password
						</code>
					</DialogContent>
				</Dialog>

				<Link
					href={getPagePath($router, "home")}
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium mt-1"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					<Trans>Back to Sign in</Trans>
				</Link>
			</div>
		</div>
	)
}
