export default function ResetConfirmModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="reset-modal-overlay" onClick={onCancel} role="presentation">
      <section
        className="reset-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-progress-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="reset-progress-title">진행상황 초기화</h3>
        <p>
          지금까지 저장된 게임 진행상황을 모두 삭제합니다.
          <br />
          이 작업은 되돌릴 수 없습니다.
        </p>

        <div className="reset-modal-actions">
          <button className="reset-modal-button" onClick={onCancel} type="button">
            취소
          </button>
          <button className="reset-modal-button danger" onClick={onConfirm} type="button">
            초기화 진행
          </button>
        </div>
      </section>
    </div>
  );
}
