import { Trans } from "@lingui/react/macro"
import { LoaderCircle, MailIcon, SendHorizonalIcon } from "lucide-react"
import { useCallback, useState } from "react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/otp"
import { pb } from "@/lib/api"
import { $authenticated } from "@/lib/stores"
import { $router } from "../router"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { showLoginFaliedToast } from "./auth-form"

export function OtpInputForm({ otpId, mfaId }: { otpId: string; mfaId: string }) {
	const [value, setValue] = useState("")

	if (value.length === 6) {
		pb.collection("users")
			.authWithOTP(otpId, value, { mfaId })
			.then(() => {
				$router.open("/")
				$authenticated.set(true)
			})
			.catch((err) => {
				showLoginFaliedToast(err, err.message)
			})
	}

	return (
		<div className="grid gap-3 items-center justify-center">
			<InputOTP maxLength={6} value={value} onChange={setValue} autoFocus>
				<InputOTPGroup>
					{Array.from({ length: 6 }).map((_, i) => (
						<InputOTPSlot key={i} index={i} />
					))}
				</InputOTPGroup>
			</InputOTP>
			<div className="text-center text-sm text-muted-foreground">
				<Trans>Enter your one-time password.</Trans>
			</div>
		</div>
	)
}

export function OtpRequestForm() {
	const [isLoading, setIsLoading] = useState<boolean>(false)
	const [email, setEmail] = useState("")
	const [otpId, setOtpId] = useState<string | undefined>()

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()
			setIsLoading(true)
			try {
				// console.log(email)
				const { otpId } = await pb.collection("users").requestOTP(email)
				setOtpId(otpId)
			} catch (e: any) {
				showLoginFaliedToast(e, e?.message)
			} finally {
				setIsLoading(false)
				setEmail("")
			}
		},
		[email]
	)

	if (otpId) {
		return <OtpInputForm otpId={otpId} mfaId={""} />
	}

	return (
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
					<Trans>Request OTP</Trans>
				</button>
			</div>
		</form>
	)
}
