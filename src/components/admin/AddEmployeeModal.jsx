import { useRef, useState } from "react";

import { computeDescriptorFromFile, loadFaceApiModels } from "@/lib/faceApi";

const initialForm = { fullName: "", email: "", password: "" };

export default function AddEmployeeModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoName, setPhotoName] = useState("");
  const fileInputRef = useRef(null);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetFormState = () => {
    setForm(initialForm);
    setPhotoFile(null);
    setPhotoName("");
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!photoFile) {
      setError("Пожалуйста, добавьте фотографию сотрудника");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await loadFaceApiModels();
      const descriptor = await computeDescriptorFromFile(photoFile);

      await onSuccess({ ...form, descriptor });
      resetFormState();
      onClose();
    } catch (err) {
      const messageText =
        err.response?.data?.message ||
        err.message ||
        "Не удалось сохранить сотрудника. Попробуйте позже.";
      setError(messageText);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget && !submitting) {
      resetFormState();
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content" style={{ width: "min(540px, 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.5rem" }}>
            Добавить сотрудника
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!submitting) {
                resetFormState();
                onClose();
              }
            }}
            disabled={submitting}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: "0.25rem",
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1.25rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500, color: "var(--text-secondary)" }}>
              ФИО
            </label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleInputChange}
              required
              placeholder="Фамилия Имя"
              style={{ width: "100%" }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500, color: "var(--text-secondary)" }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleInputChange}
              required
              placeholder="example@company.com"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500, color: "var(--text-secondary)" }}>
              Пароль
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleInputChange}
              required
              minLength={6}
              placeholder="Минимум 6 символов"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 500, color: "var(--text-secondary)" }}>
              Фотография сотрудника
            </label>
            <label
              className="secondary-button"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", minHeight: "2.75rem" }}
            >
              <span>{photoName || "Выберите изображение"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setPhotoFile(file);
                    setPhotoName(file.name);
                  } else {
                    setPhotoFile(null);
                    setPhotoName("");
                  }
                }}
                disabled={submitting}
              />
            </label>
            <p style={{ margin: "0.5rem 0 0", color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
              Выберите четкое фото лица в хорошем освещении.
            </p>
          </div>

          {error && (
            <div
              style={{
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#dc2626",
                fontSize: "0.9rem"
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting}
              style={{ flex: 1 }}
            >
              <span>{submitting ? "Создание..." : "Добавить сотрудника"}</span>
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (!submitting) {
                  resetFormState();
                  onClose();
                }
              }}
              disabled={submitting}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
