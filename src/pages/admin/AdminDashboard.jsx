import { useEffect, useState } from "react";

import api from "@/lib/api";
import { computeDescriptorFromFile, loadFaceApiModels } from "@/lib/faceApi";
import AddEmployeeModal from "@/components/admin/AddEmployeeModal.jsx";
import AttendanceDashboard from "@/components/admin/AttendanceDashboard.jsx";
import ProgressBar from "@/components/common/ProgressBar.jsx";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/users");
      setUsers(response.data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (formData) => {
    const response = await api.post("/admin/users", formData);
    setMessage("Сотрудник создан и фотография сохранена");
    loadUsers();
    return response.data;
  };

  const handleUpload = async (userId, file) => {
    if (!file) {
      return;
    }

    setUploadProgress((prev) => ({ ...prev, [userId]: 0 }));
    setMessage("");
    setError("");

    try {
      // Step 1: Load models (33%)
      setUploadProgress((prev) => ({ ...prev, [userId]: 10 }));
      await loadFaceApiModels();
      setUploadProgress((prev) => ({ ...prev, [userId]: 33 }));

      // Step 2: Compute descriptor (66%)
      const descriptor = await computeDescriptorFromFile(file);
      setUploadProgress((prev) => ({ ...prev, [userId]: 66 }));

      // Step 3: Upload to server (100%)
      const uploadResponse = await api.post(`/admin/users/${userId}/photo`, { descriptor }, {
        headers: { "Content-Type": "application/json" }
      });
      const replaced = Boolean(uploadResponse?.data?.replaced);
      setUploadProgress((prev) => ({ ...prev, [userId]: 100 }));

      setTimeout(() => {
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[userId];
          return newProgress;
        });
        setMessage(replaced ? "Фотография обновлена" : "Фотография успешно загружена");
        loadUsers();
      }, 500);
    } catch (err) {
      const messageText = err.response?.data?.message || err.message || "Ошибка при загрузке изображения";
      setError(messageText);
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[userId];
        return newProgress;
      });
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Удалить сотрудника вместе с его данными?")) {
      return;
    }

    try {
      await api.delete(`/admin/users/${userId}`);
      setMessage("Сотрудник удалён");
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      const messageText = err.response?.data?.message || "Ошибка при удалении сотрудника";
      setError(messageText);
    }
  };

  return (
    <div style={{ display: "grid", gap: "2.5rem", maxWidth: "1400px", margin: "0 auto" }}>
      <AddEmployeeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCreate}
      />

      <div className="card fade-in" style={{ display: "grid", gap: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.75rem" }}>
              Управление сотрудниками
            </h2>
            <p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)" }}>
              Добавляйте сотрудников, загружайте фотографии и контролируйте наличие дескриптора у каждого сотрудника.
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => setModalOpen(true)}
          >
            <span>+ Добавить сотрудника</span>
          </button>
        </div>

        {message && (
          <div style={{
            padding: "1rem 1.25rem",
            borderRadius: "var(--radius-md)",
            background: "rgba(16, 185, 129, 0.1)",
            color: "#059669",
            fontSize: "0.95rem",
            fontWeight: 500
          }}>
            {message}
          </div>
        )}
        {error && (
          <div style={{
            padding: "1rem 1.25rem",
            borderRadius: "var(--radius-md)",
            background: "rgba(239, 68, 68, 0.1)",
            color: "#dc2626",
            fontSize: "0.95rem",
            fontWeight: 500
          }}>
            {error}
          </div>
        )}
      </div>

      <div className="card fade-in">
        <h3 style={{ margin: "0 0 1.5rem", color: "var(--text-primary)", fontSize: "1.4rem" }}>
          Сотрудники ({users.length})
        </h3>
        {loading ? (
          <div style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--text-tertiary)"
          }}>
            Загрузка...
          </div>
        ) : users.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--text-tertiary)",
            background: "var(--bg-tertiary)",
            borderRadius: "var(--radius-md)"
          }}>
            Сотрудников пока нет. Нажмите «Добавить сотрудника», чтобы создать нового.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {users.map((user) => (
              <div
                key={user.id}
                className="card-compact"
                style={{ display: "grid", gap: "1rem" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "1.05rem" }}>
                        {user.fullName || "Без имени"}
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                        {user.email}
                      </div>
                    </div>
                    {user.descriptorCount > 0 ? (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        background: "rgba(16, 185, 129, 0.15)",
                        borderRadius: "50%",
                        color: "#059669",
                        fontSize: "1.1rem",
                        fontWeight: 600
                      }} title="Фото загружено">
                        ✓
                      </div>
                    ) : (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        background: "rgba(239, 68, 68, 0.15)",
                        borderRadius: "50%",
                        color: "#dc2626",
                        fontSize: "1.1rem",
                        fontWeight: 600
                      }} title="Фото не загружено">
                        ✗
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <label className="secondary-button" style={{ cursor: "pointer" }}>
                      {user.descriptorCount > 0 ? "Обновить фото" : "Загрузить фото"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          handleUpload(user.id, file);
                        }}
                        disabled={uploadProgress[user.id] !== undefined}
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleDelete(user.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                {uploadProgress[user.id] !== undefined && (
                  <ProgressBar
                    progress={uploadProgress[user.id]}
                    label="Загрузка изображения"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AttendanceDashboard />
    </div>
  );
}
