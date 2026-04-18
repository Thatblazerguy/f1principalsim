'use client';
import React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

export function Header() {
	const [open, setOpen] = React.useState(false);
	const scrolled = useScroll(10);

	const primaryLinks = [
		{ label: 'Dashboard', href: '#' },
		{ label: 'Race Weekend', href: '#' },
		{ label: 'Upgrade Car', href: '#' },
		{ label: 'My Drivers', href: '#' },
	];

	const moreLinks = [
		{ label: 'Teams', href: '#' },
		{ label: 'Sponsors', href: '#' },
		{ label: 'Driver Market', href: '#' },
		{ label: 'Calendar', href: '#' },
		{ label: 'Standings', href: '#' },
	];

	const allLinks = [...primaryLinks, ...moreLinks];

	React.useEffect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}

		return () => {
			document.body.style.overflow = '';
		};
	}, [open]);

	return (
		<header
			className={cn(
				'sticky top-0 z-50 mx-auto w-full max-w-[1300px] border-b border-transparent md:rounded-xl md:border md:transition-all md:ease-out',
				{
					'border-white/10 shadow-lg shadow-black/20 backdrop-blur-xl md:top-3':
						scrolled && !open,
					'backdrop-blur-lg': open,
				},
			)}
			style={{
				background: scrolled && !open
					? 'linear-gradient(135deg, rgba(80, 0, 0, 0.92), rgba(30, 0, 0, 0.96))'
					: 'linear-gradient(135deg, rgba(60, 0, 0, 0.85), rgba(20, 0, 0, 0.9))',
			}}
		>
			<nav className="flex h-[68px] w-full items-center justify-between gap-4 px-5">
				{/* Branding */}
				<div className="flex items-center gap-3 shrink-0">
					<span
						className="inline-flex items-center justify-center w-10 h-10 rounded-full font-extrabold text-white text-sm"
						style={{ background: 'linear-gradient(135deg, #7e0c0c, #e10600)' }}
					>
						F1
					</span>
					<span className="text-white font-bold text-base tracking-tight">
						Command Hub
					</span>
				</div>

				{/* Desktop Nav Links */}
				<div className="hidden lg:flex items-center justify-center flex-1 gap-2">
					{primaryLinks.map((link, i) => (
						<a
							key={i}
							className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/85 border border-white/8 bg-white/[0.04] hover:bg-white/10 hover:border-white/15 transition-colors shrink-0"
							href={link.href}
						>
							{link.label}
						</a>
					))}

					{/* More Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/85 border border-white/8 bg-white/[0.04] hover:bg-white/10 hover:border-white/15 transition-colors shrink-0 gap-1"
							>
								More
								<ChevronDown size={14} className="opacity-70" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="hub-dropdown-content"
							sideOffset={8}
							align="center"
						>
							{moreLinks.map((link) => (
								<DropdownMenuItem
									key={link.label}
									className="hub-dropdown-item"
									asChild
								>
									<a href={link.href}>{link.label}</a>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Desktop Logout */}
				<div className="hidden lg:flex items-center shrink-0">
					<Button
						variant="outline"
						className="rounded-full border-red-400/30 text-red-300 hover:bg-red-500/15 hover:text-red-200 text-xs font-semibold uppercase tracking-wide"
					>
						Logout
					</Button>
				</div>

				{/* Mobile Hamburger */}
				<Button size="icon" variant="outline" onClick={() => setOpen(!open)} className="lg:hidden border-white/15 text-white">
					<MenuToggleIcon open={open} className="size-5" duration={300} />
				</Button>
			</nav>

			{/* Mobile Menu */}
			<div
				className={cn(
					'fixed top-[68px] right-0 bottom-0 left-0 z-50 flex flex-col overflow-auto border-t border-white/10 lg:hidden',
					open ? 'block' : 'hidden',
				)}
				style={{
					background: 'linear-gradient(180deg, rgba(40, 0, 0, 0.97), rgba(15, 0, 0, 0.98))',
				}}
			>
				<div
					data-slot={open ? 'open' : 'closed'}
					className={cn(
						'data-[slot=open]:animate-in data-[slot=open]:zoom-in-95 data-[slot=closed]:animate-out data-[slot=closed]:zoom-out-95 ease-out',
						'flex h-full w-full flex-col justify-between gap-y-2 p-5',
					)}
				>
					<div className="grid gap-y-1">
						{allLinks.map((link) => (
							<a
								key={link.label}
								className="flex items-center justify-start rounded-xl px-4 py-3 text-sm font-semibold text-white/85 hover:bg-white/8 hover:text-white transition-colors"
								href={link.href}
							>
								{link.label}
							</a>
						))}
					</div>
					<div className="flex flex-col gap-2 pt-4 border-t border-white/10">
						<Button
							variant="outline"
							className="w-full rounded-full border-red-400/30 text-red-300 hover:bg-red-500/15 hover:text-red-200 font-semibold uppercase tracking-wide"
						>
							Logout
						</Button>
					</div>
				</div>
			</div>
		</header>
	);
}
