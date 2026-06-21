import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function UserMenu({
  user,
  open,
  setOpen,
  onLogout,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  onLogout: () => void
}) {
  return (
    <div className="relative" data-user-menu-root>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full text-[#999999]"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {user.avatarUrl ? (
          <img
            className="h-7 w-7 rounded-full object-cover"
            src={user.avatarUrl}
            alt={user.name ?? user.email}
          />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#2a2a2a] text-[#999999]">
            <UserRound size={14} aria-hidden="true" />
          </span>
        )}
        <span className="max-w-[120px] truncate text-[13px] font-medium text-[#e5e5e5]">
          {user.name ?? user.email}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#666666] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </Button>
      <div
        className={`absolute right-0 top-full z-50 mt-2 min-w-40 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)] ${
          open ? 'grid' : 'hidden'
        }`}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-start gap-2 rounded-[7px] px-2.5 text-[13px] font-medium text-[#999999] hover:text-[#e5e5e5]"
          onClick={() => {
            setOpen(false)
            onLogout()
          }}
        >
          <LogOut size={15} aria-hidden="true" />
          退出登录
        </Button>
      </div>
    </div>
  )
}
