export function JumpNav() {
  return (
    <nav aria-label="Jump" className="flex gap-4 text-sm">
      <a className="underline-offset-4 hover:underline" href="#tokens">
        Tokens
      </a>
      <a className="underline-offset-4 hover:underline" href="#primitives">
        Primitives
      </a>
      <a className="underline-offset-4 hover:underline" href="#patterns">
        Patterns
      </a>
    </nav>
  )
}
