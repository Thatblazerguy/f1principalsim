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
        'w-full sticky top-0 z-50 border-b border-transparent md:transition-all md:ease-out',
        {
          'bg-background/95 supports-[backdrop-filter]:bg-background/50 border-border backdrop-blur-lg md:shadow':
            scrolled && !open,
          'bg-background/90': open,
        },
      )}
    >
      <nav
        className={cn(
          'flex h-14 w-full items-center md:h-12 md:transition-all md:ease-out',
          {
            'md:px-2': scrolled,
          },
        )}
      >
        <div className="max-w-[1300px] mx-auto w-full flex items-center justify-between px-4">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
             <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#7e0c0c] to-[#e10600] flex items-center justify-center text-white font-bold text-xs">F1</div>
             <span className="font-bold text-sm tracking-tight">Command Hub</span>
          </div>

          {/* Center: Nav links */}
          <div className="hidden md:flex flex-1 justify-center items-center gap-2 whitespace-nowrap">
            {primaryLinks.map((link, i) => (
              <a key={i} className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={link.href}>
                {link.label}
              </a>
            ))}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  More
                  <ChevronDown className="opacity-60" size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[160px]">
                {moreLinks.map((link) => (
                  <DropdownMenuItem key={link.label} asChild>
                    <a href={link.href}>{link.label}</a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right: Logout */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <Button variant="outline" size="sm">Logout</Button>
            </div>
            <Button size="icon" variant="outline" onClick={() => setOpen(!open)} className="md:hidden">
              <MenuToggleIcon open={open} className="size-5" duration={300} />
            </Button>
          </div>
        </div>
      </nav>

      <div
        className={cn(
          'bg-background/90 fixed top-14 right-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden border-y md:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <div
          data-slot={open ? 'open' : 'closed'}
          className={cn(
            'data-[slot=open]:animate-in data-[slot=open]:zoom-in-95 data-[slot=closed]:animate-out data-[slot=closed]:zoom-out-95 ease-out',
            'flex h-full w-full flex-col justify-between gap-y-2 p-4',
          )}
        >
          <div className="grid gap-y-2">
            {allLinks.map((link) => (
              <a
                key={link.label}
                className={buttonVariants({
                  variant: 'ghost',
                  className: 'justify-start',
                })}
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full">
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
