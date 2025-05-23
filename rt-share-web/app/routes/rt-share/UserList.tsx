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
        <div className="w-full bg-tertiary-light border-b border-tertiary-dark overflow-y-auto md:w-[250px] md:border-b-0 md:border-r dark:bg-secondary dark:border-secondary">
            <h2 className="p-4 m-0 bg-tertiary border-b border-tertiary-dark dark:bg-secondary-light dark:border-secondary">{heading}</h2>
            <label className="w-full p-3 dark:border-secondary flex items-center justify-between gap-2 cursor-pointer hover:bg-tertiary dark:hover:bg-secondary-light">
                <span>Local Only</span>
                <input
                    type="checkbox"
                    checked={localOnly}
                    onChange={() => setLocalOnly(v => !v)}
                    className="form-checkbox h-5 w-5 text-details-dark"
                />
            </label>
            <ul className="list-none p-0 m-0">
                {users
                    .filter(u => u.id !== currentUser)
                    .filter(u => !localOnly || (myIp && u.ip === myIp))
                    .map(u => (
                        <li
                            key={u.id}
                            className={`p-3 cursor-pointer border-b border-tertiary-dark hover:bg-tertiary dark:border-secondary dark:hover:bg-secondary-light ${selectedUser === u.id ? "bg-tertiary-dark font-bold dark:bg-secondary-light dark:text-tertiary-light" : ""} ${!u.isOnline ? "opacity-50" : ""}`}
                            onClick={() => onSelect(u.id)}
                        >
                            {u.id} {!u.isOnline && "(Offline)"}
                        </li>
                    ))}
            </ul>
        </div>
    );
}
