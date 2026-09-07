export default function CallRoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-background supports-[height:100dvh]:h-dvh">
      {children}
    </div>
  )
}
