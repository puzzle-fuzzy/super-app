import { Link } from 'react-router-dom'
import { FileText, FolderOpen, Key, LogOut, Send, Shield, UserRound } from 'lucide-react'

import { clientEnv } from '@super-app/env/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/material-ui-dropdown-menu'

const MENU_LINKS = [
  { label: '资产库', path: '/assets', Icon: FolderOpen },
  { label: '传输', path: '/transfer', Icon: Send },
  { label: 'API 密钥', path: '/api-console', Icon: Key },
  { label: '文档', href: clientEnv.SUPER_PUBLIC_DOCS_URL, Icon: FileText },
  { label: '管理', path: '/admin', Icon: Shield },
]

export function UserMenu({
  user,
  credits = 0,
  open,
  setOpen,
  onLogout,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  credits?: number
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  onLogout: () => void
}) {
  return (
    <div className="flex items-center gap-2" data-user-menu-root>
      {/* Credits */}
      <span className="flex items-center gap-1 text-[11px]">
        <span className="text-[#666666]">积分</span>
        <span className="font-semibold text-[#e5e5e5] tabular-nums leading-none">{credits}</span>
      </span>

      {/* User avatar + dropdown */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Avatar className="h-7 w-7 cursor-pointer">
            <AvatarImage src={user.avatarUrl} alt={user.name ?? ''} />
            <AvatarFallback>
              <UserRound size={13} aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <div className="px-4 py-3">
            <p className="m-0 text-[13px] font-medium text-[#e5e5e5] truncate">
              {user.name ?? '未命名用户'}
            </p>
            <p className="m-0 mt-0.5 text-[11px] text-[#666666] truncate">
              {user.email ?? ''}
            </p>
          </div>
          <DropdownMenuSeparator />
          {MENU_LINKS.map((item) =>
            item.path ? (
              <DropdownMenuItem key={item.label} asChild delayDuration={0}>
                <Link to={item.path} className="no-underline">
                  <item.Icon size={15} aria-hidden="true" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={item.label} asChild delayDuration={0}>
                <a href={item.href} className="no-underline">
                  <item.Icon size={15} aria-hidden="true" />
                  {item.label}
                </a>
              </DropdownMenuItem>
            )
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem delayDuration={0} onSelect={() => onLogout()}>
            <LogOut size={15} aria-hidden="true" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
