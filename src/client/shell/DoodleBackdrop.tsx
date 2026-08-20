export function DoodleBackdrop({ variant }: { variant: 'auth' | 'app' }) {
  return <div className="doodle-backdrop" data-variant={variant} aria-hidden />
}
