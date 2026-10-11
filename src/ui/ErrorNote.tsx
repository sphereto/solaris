/** An error message with a way to try again. */
export function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p className="discover-error" role="status">
      {message}{' '}
      <button className="retry-btn" onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}
