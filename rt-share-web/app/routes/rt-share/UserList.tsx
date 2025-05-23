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
    <div className="w-full bg-white border-b border-gray-300 overflow-y-auto max-h-[30vh] md:w-[250px] md:border-b-0 md:border-r dark:bg-gray-900 dark:border-gray-700">
      <h2 className="p-4 m-0 bg-gray-100 border-b border-gray-300 dark:bg-gray-800 dark:border-gray-700">{heading}</h2>
      <label className="m-2 p-2 border border-gray-300 rounded dark:border-gray-600 inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={localOnly}
          onChange={() => setLocalOnly(v => !v)}
        />
        Local Only
      </label>
      <ul className="list-none p-0 m-0">
        {users
          .filter(u => u.id !== currentUser)
          .filter(u => !localOnly || (myIp && u.ip === myIp))
          .map(u => (
            <li
              key={u.id}
              className={`p-3 cursor-pointer border-b border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700 ${selectedUser === u.id ? "bg-gray-200 font-bold dark:bg-gray-800 dark:text-white" : ""} ${!u.isOnline ? "opacity-50" : ""}`}
              onClick={() => onSelect(u.id)}
            >
              {u.id} {!u.isOnline && "(Offline)"}
            </li>
          ))}
      </ul>
    </div>
  );
}
