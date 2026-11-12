export function Logo({ className }: { className?: string }) {
	return (
		<div className={`flex items-center gap-2.5 select-none ${className || ""}`}>
			<svg
				role="img"
				aria-label="DockMon Logo"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 32 32"
				className="h-6 w-6 shrink-0 text-foreground"
			>
				{/* Clean geometric isometric server/container cube */}
				<path
					d="M16 3L4 9.5v13L16 29l12-6.5v-13L16 3z"
					className="fill-foreground/10 stroke-foreground"
					strokeWidth="1.75"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M16 3v13M16 16L4 9.5M16 16l12-6.5M16 16v13"
					className="stroke-foreground"
					strokeWidth="1.75"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<circle cx="16" cy="16" r="2.5" className="fill-foreground" />
			</svg>
			<span className="text-base font-semibold tracking-tight text-foreground">
				DockMon
			</span>
		</div>
	)
}
