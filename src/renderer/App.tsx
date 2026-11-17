import { useEffect, useRef, useState } from "react";
import { getSchema, type Editor as TiptapEditor } from "@tiptap/react";
import {
	ArrowUpRight,
	Check,
	ChevronLeft,
	ChevronRight,
	Link,
	MoreHorizontal,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import type { AppCommand } from "../shared/api";
import type { Notebook } from "../shared/types";
import {
	createNote,
	deleteNote,
	moveNote,
	updateContent,
} from "../shared/notebook";
import { Editor } from "./Editor";
import { extensions } from "./extensions";
import { SaveQueue, type SaveState } from "./save-queue";
import { Modal } from "./Modal";

export function App() {
	const [book, setBook] = useState<Notebook | null>(null);
	const current = useRef<Notebook | null>(null);
	const editor = useRef<TiptapEditor | null>(null);
	const [saveState, setSaveState] = useState<SaveState>("saved");
	const [loadError, setLoadError] = useState("");
	const [menu, setMenu] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [link, setLink] = useState<{
		from: number;
		to: number;
		href: string;
	} | null>(null);
	const [linkError, setLinkError] = useState("");
	const [queue] = useState(
		() => new SaveQueue((value) => window.kknote.save(value), setSaveState),
	);
	const commands = useRef<(value: AppCommand) => void>(() => {});

	function commit(next: Notebook): void {
		current.current = next;
		setBook(next);
		queue.request(next);
	}
	function closeLink(): void {
		setLink(null);
		setLinkError("");
		editor.current?.commands.focus();
	}
	function openLink(): void {
		const ed = editor.current;
		if (!ed) return;
		const { from, to } = ed.state.selection;
		setLink({
			from,
			to,
			href: (ed.getAttributes("link").href as string) || "",
		});
		setLinkError("");
		setMenu(false);
	}
	function act(value: AppCommand): void {
		const valueBook = current.current;
		if (!valueBook) return;
		if (value === "focus") {
			if (!link && !confirmDelete) editor.current?.commands.focus();
			return;
		}
		if (link || confirmDelete) return;
		setMenu(false);
		if (value === "new") commit(createNote(valueBook));
		if (value === "previous" || value === "next")
			commit(moveNote(valueBook, value === "previous" ? -1 : 1));
		if (value === "delete") setConfirmDelete(true);
		if (value !== "delete") void queue.flush().catch(() => {});
	}
	commands.current = act;

	useEffect(() => {
		let cancelled = false;
		void window.kknote
			.load()
			.then((value) => {
				const schema = getSchema(extensions);
				for (const note of value.notes)
					schema.nodeFromJSON(note.content).check();
				if (!cancelled) {
					current.current = value;
					setBook(value);
					queue.request(value);
				}
			})
			.catch((error) => {
				if (!cancelled) setLoadError(String(error));
			});
		const offFlush = window.kknote.onFlush(() => queue.flush());
		const offCommand = window.kknote.onCommand((value) =>
			commands.current(value),
		);
		const listener = (event: KeyboardEvent) => keyRef.current(event);
		document.addEventListener("keydown", listener);
		return () => {
			cancelled = true;
			offFlush();
			offCommand();
			document.removeEventListener("keydown", listener);
		};
	}, [queue]);
	const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
	keyRef.current = (event) => {
		if (event.isComposing) return;
		if (event.key === "Escape") {
			event.preventDefault();
			if (link) closeLink();
			else if (confirmDelete) setConfirmDelete(false);
			else if (menu) setMenu(false);
			else window.kknote.hide();
		}
		if (
			(event.metaKey || event.ctrlKey) &&
			event.shiftKey &&
			["BracketLeft", "BracketRight"].includes(event.code)
		) {
			event.preventDefault();
			act(event.code === "BracketLeft" ? "previous" : "next");
		}
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
			event.preventDefault();
			act("new");
		}
	};

	function applyLink(event: React.FormEvent): void {
		event.preventDefault();
		if (!link || !editor.current) return;
		const href = link.href.trim();
		try {
			if (!["https:", "http:", "mailto:"].includes(new URL(href).protocol))
				throw new Error();
		} catch {
			setLinkError("http, https, mailto 주소를 입력해 주세요.");
			return;
		}
		const chain = editor.current
			.chain()
			.focus()
			.setTextSelection({ from: link.from, to: link.to })
			.extendMarkRange("link");
		if (link.from === link.to && !editor.current.isActive("link"))
			chain
				.insertContent({
					type: "text",
					text: href,
					marks: [{ type: "link", attrs: { href } }],
				})
				.run();
		else chain.setLink({ href }).run();
		setLink(null);
		setLinkError("");
	}
	function format(run: (ed: TiptapEditor) => void): void {
		if (editor.current) run(editor.current);
		setMenu(false);
	}

	if (loadError)
		return (
			<main className="error-screen">
				<span className="eyebrow">kknote</span>
				<h1>메모를 불러오지 못했어요</h1>
				<p>
					원본을 보호하기 위해 저장을 멈췄어요.
					<br />
					저장 폴더의 notes.json 파일을 확인해 주세요.
				</p>
				<details>
					<summary>오류 보기</summary>
					<p>{loadError}</p>
				</details>
				<button
					className="primary"
					onClick={() => void window.kknote.openDataFolder()}
				>
					저장 폴더 열기
				</button>
				<button onClick={() => location.reload()}>다시 불러오기</button>
			</main>
		);
	if (!book) return <main className="loading">메모를 펼치는 중…</main>;
	const note = book.notes.find((n) => n.id === book.activeId)!;
	const index = book.notes.indexOf(note);

	return (
		<main className="paper">
			<header className="titlebar">
				<span className="app-name">kknote</span>
				<div className="actions">
					<button
						aria-label="링크 삽입"
						title="링크 삽입 · ⌘K"
						onMouseDown={(e) => e.preventDefault()}
						onClick={openLink}
					>
						<Link size={17} strokeWidth={1.6} />
					</button>
					<button
						aria-label="새 메모"
						title="새 메모 · ⌘N"
						onClick={() => act("new")}
					>
						<Plus size={21} strokeWidth={1.5} />
					</button>
					<button
						aria-label="메모 메뉴"
						title="메모 메뉴"
						aria-expanded={menu}
						onClick={() => setMenu(!menu)}
					>
						<MoreHorizontal size={21} strokeWidth={1.5} />
					</button>
				</div>
			</header>
			{menu && (
				<>
					<button
						className="menu-dismiss"
						aria-label="메뉴 닫기"
						onClick={() => setMenu(false)}
					/>
					<div className="dropdown" role="menu">
						<div className="menu-label">서식</div>
						<button
							role="menuitem"
							onClick={() =>
								format((ed) => ed.chain().focus().setParagraph().run())
							}
						>
							<span>일반 텍스트</span>
							<kbd>⌘⌥0</kbd>
						</button>
						{([1, 2, 3] as const).map((level) => (
							<button
								role="menuitem"
								key={level}
								onClick={() =>
									format((ed) =>
										ed.chain().focus().toggleHeading({ level }).run(),
									)
								}
							>
								<span>제목 {level}</span>
								<kbd>{"#".repeat(level)}</kbd>
							</button>
						))}
						<button
							role="menuitem"
							onClick={() =>
								format((ed) => ed.chain().focus().toggleBulletList().run())
							}
						>
							<span>글머리 목록</span>
							<kbd>-</kbd>
						</button>
						<button
							role="menuitem"
							onClick={() =>
								format((ed) => ed.chain().focus().toggleOrderedList().run())
							}
						>
							<span>번호 목록</span>
							<kbd>1.</kbd>
						</button>
						<button
							role="menuitem"
							onClick={() =>
								format((ed) => ed.chain().focus().toggleTaskList().run())
							}
						>
							<span>체크리스트</span>
							<kbd>[]</kbd>
						</button>
						<button
							role="menuitem"
							onClick={() =>
								format((ed) => ed.chain().focus().toggleBlockquote().run())
							}
						>
							<span>인용</span>
							<kbd>&gt;</kbd>
						</button>
						<button
							role="menuitem"
							onClick={() =>
								format((ed) => ed.chain().focus().toggleCodeBlock().run())
							}
						>
							<span>코드블록</span>
							<kbd>```</kbd>
						</button>
						<div className="menu-divider" />
						<button
							role="menuitem"
							className="danger"
							onClick={() => act("delete")}
						>
							<span>
								<Trash2 size={14} /> 메모 삭제…
							</span>
						</button>
						<div className="menu-divider" />
						<div className="menu-footnote">
							⌥A 어디서든 열기
							<br />
							⌘⇧[ / ] 메모 이동
							<br />
							⌘B 굵게 · ⌘I 기울임
							<br />
							⌘클릭으로 링크 열기
						</div>
					</div>
				</>
			)}
			<div className="writing-area">
				<Editor
					key={note.id}
					content={note.content}
					onReady={(ed) => {
						editor.current = ed;
					}}
					onLink={openLink}
					onChange={(content) => {
						if (current.current)
							commit(updateContent(current.current, content));
					}}
				/>
			</div>
			<footer>
				<div className="save-indicator">
					<span className={`save-dot ${saveState}`} />
					<span role="status">
						{saveState === "saving"
							? "저장 중…"
							: saveState === "error"
								? "저장하지 못했어요"
								: "저장됨"}
					</span>
					{saveState === "error" && (
						<button onClick={() => void queue.flush().catch(() => {})}>
							재시도
						</button>
					)}
				</div>
				<nav aria-label="메모 이동">
					<button
						aria-label="이전 메모"
						title="이전 메모 · ⌘⇧["
						onClick={() => act("previous")}
					>
						<ChevronLeft size={19} strokeWidth={1.5} />
					</button>
					<span className="page-count">
						{index + 1}
						<span className="slash">/</span>
						{book.notes.length}
					</span>
					<button
						aria-label="다음 메모"
						title="다음 메모 · ⌘⇧]"
						onClick={() => act("next")}
					>
						<ChevronRight size={19} strokeWidth={1.5} />
					</button>
				</nav>
			</footer>
			{link && (
				<Modal titleId="link-title" onDismiss={closeLink}>
					<div className="modal-heading">
						<h2 id="link-title">링크 삽입</h2>
						<button aria-label="닫기" onClick={closeLink}>
							<X size={17} />
						</button>
					</div>
					<form onSubmit={applyLink}>
						<label htmlFor="link-url">링크 주소</label>
						<input
							id="link-url"
							autoFocus
							value={link.href}
							placeholder="https://"
							onChange={(e) => setLink({ ...link, href: e.target.value })}
						/>
						{linkError && (
							<p className="error-text" role="alert">
								{linkError}
							</p>
						)}
						<div className="modal-actions">
							<button
								type="button"
								onClick={() => {
									editor.current
										?.chain()
										.focus()
										.setTextSelection({ from: link.from, to: link.to })
										.extendMarkRange("link")
										.unsetLink()
										.run();
									setLink(null);
								}}
							>
								링크 제거
							</button>
							<button className="primary" type="submit">
								<Check size={14} /> 적용
							</button>
						</div>
					</form>
					{link.href && (
						<button
							className="open-link"
							onClick={() => {
								void window.kknote
									.openExternal(link.href)
									.catch((error) => setLinkError(String(error)));
							}}
						>
							브라우저에서 열기 <ArrowUpRight size={13} />
						</button>
					)}
				</Modal>
			)}
			{confirmDelete && (
				<Modal titleId="delete-title" onDismiss={() => setConfirmDelete(false)}>
					<h2 id="delete-title">이 메모를 삭제할까요?</h2>
					<p>삭제한 메모는 되돌릴 수 없어요.</p>
					<div className="modal-actions">
						<button
							autoFocus
							onClick={() => {
								setConfirmDelete(false);
								editor.current?.commands.focus();
							}}
						>
							취소
						</button>
						<button
							className="primary delete"
							onClick={() => {
								commit(deleteNote(current.current!, current.current!.activeId));
								setConfirmDelete(false);
								void queue.flush().catch(() => {});
							}}
						>
							삭제
						</button>
					</div>
				</Modal>
			)}
		</main>
	);
}
