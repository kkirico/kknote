import { useLayoutEffect, useRef, type ReactNode } from "react";

export function Modal({
	titleId,
	onDismiss,
	children,
}: {
	titleId: string;
	onDismiss: () => void;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	useLayoutEffect(() => {
		ref.current?.showModal();
	}, []);
	return (
		<dialog
			ref={ref}
			className="modal"
			role="dialog"
			aria-labelledby={titleId}
			onCancel={(event) => {
				event.preventDefault();
				onDismiss();
			}}
			onKeyDown={(event) => {
				if (event.key !== "Tab") return;
				const elements = Array.from(
					ref.current!.querySelectorAll<HTMLElement>(
						'button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]',
					),
				);
				const first = elements[0];
				const last = elements.at(-1);
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last?.focus();
				}
				if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first?.focus();
				}
			}}
		>
			{children}
		</dialog>
	);
}
