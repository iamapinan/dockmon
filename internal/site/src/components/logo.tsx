import { useId } from "react"

export function Logo({ className }: { className?: string }) {
	const id = useId()

	return (
		<div className={`flex items-center gap-2 font-bold tracking-tight select-none ${className || ""}`}>
			<svg
				role="img"
				aria-label="DockMon Logo"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 32 32"
				className="h-7 w-7 shrink-0"
			>
				<defs>
					<linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#3b82f6" />
						<stop offset="100%" stopColor="#10b981" />
					</linearGradient>
				</defs>
				{/* Modern Container / Server Hexagon Cube */}
				<path
					d="M16 2L3 9v14l13 7 13-7V9L16 2z"
					fill={`url(#${id})`}
					opacity="0.95"
				/>
				<path
					d="M16 2v14M16 16L3 9M16 16l13-7M16 16v14"
					stroke="currentColor"
					strokeWidth="1.75"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-background"
				/>
				{/* Pulsing Core node */}
				<circle cx="16" cy="16" r="3" fill="#ffffff" />
			</svg>
			<span className="text-lg md:text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
				DockMon
			</span>
		</div>
	)
}
