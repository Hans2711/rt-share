import { useState } from "react";
import type { User } from "./types";

interface UserListProps {
  users: User[];
  currentUser: string;
  selectedUser: string | null;
  isOnline: boolean;
  onSelect: (id: string) => void;
}

export function UserList({ users, currentUser, selectedUser, isOnline, onSelect }: UserListProps) {
  const [localOnly, setLocalOnly] = useState(false);

  const myIp = users.find(u => u.id === currentUser)?.ip;

  const heading = !isOnline
    ? "Waiting for Connection"
    : users.filter(u => u.id !== currentUser).length === 0
      ? "No Users"
      : `Users (You are ${currentUser})`;

  return (
    <div className="user-list">
      <h2>{heading}</h2>
      <label>
        <input
          type="checkbox"
          checked={localOnly}
          onChange={() => setLocalOnly(v => !v)}
        />
        Local Only
      </label>
      <ul>
        {users
          .filter(u => u.id !== currentUser)
          .filter(u => !localOnly || (myIp && u.ip === myIp))
          .map(u => (
            <li
              key={u.id}
              className={`${selectedUser === u.id ? "selected" : ""} ${!u.isOnline ? "offline" : ""}`}
              onClick={() => onSelect(u.id)}
            >
              {u.id} {!u.isOnline && "(Offline)"}
            </li>
          ))}
      </ul>
    </div>
  );
}
