import { useState } from "react";
import type { User } from "./types";

function getNetworkPrefix(ip: string): string | null {
    if (ip == "localhost") return ip;
    const parts = ip.split(".");
    return parts.length === 4 ? parts.slice(0, 3).join(".") : null;
}

interface UserListProps {
    users: User[];
    currentUser: string;
    selectedUser: string | null;
    isOnline: boolean;
    onSelect: (id: string) => void;
    onShowHistory: () => void;
}

export function UserList({ users, currentUser, selectedUser, isOnline, onSelect, onShowHistory }: UserListProps) {
    const [localOnly, setLocalOnly] = useState(false);

    const myIp = users.find(u => u.id === currentUser)?.ip;
    const myNetwork = myIp ? getNetworkPrefix(myIp) : null;

    const heading = !isOnline
        ? "Waiting for Connection"
        : users.filter(u => u.id !== currentUser).length === 0
            ? "No Users"
            : `Users (You are ${currentUser})`;

    return (
        <div className="relative w-full bg-gray-100 border-b border-gray-300 overflow-y-auto md:w-[250px] md:border-b-0 md:border-r dark:bg-gray-800 dark:border-gray-800 pb-16">
            <h2 className="p-4 m-0 bg-gray-100 border-b border-gray-300 dark:bg-gray-700 dark:border-gray-100">{heading}</h2>
            <label className="border-b border-gray-300 w-full p-3 dark:border-gray-100 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                <span>Local Only</span>
                <input
                    type="checkbox"
                    checked={localOnly}
                    onChange={() => setLocalOnly(v => !v)}
                    className="form-checkbox h-5 w-5 text-blue-600"
                />
            </label>
            <ul className="list-none p-0 m-0">
                {users
                    .filter(u => u.id !== currentUser)
                    .filter(u => {
                        if (!localOnly) return true;
                        const otherNetwork = getNetworkPrefix(u.ip);
                        return myNetwork !== null && otherNetwork === myNetwork;
                    })
                    .map(u => (
                        <li
                            key={u.id}
                            className={`p-3 cursor-pointer border-b border-gray-300 hover:bg-gray-100 dark:border-gray-100 dark:hover:bg-gray-700 ${selectedUser === u.id ? "bg-gray-300 font-bold dark:bg-gray-700 dark:text-gray-100" : ""} ${!u.isOnline ? "opacity-50" : ""}`}
                            onClick={() => onSelect(u.id)}
                        >
                            {u.id} {!u.isOnline && "(Offline)"}
                        </li>
                    ))}
            </ul>
            <button
                onClick={onShowHistory}
                className="fixed bottom-2 left-1/2 -translate-x-1/2 w-1/3 m-2 md:absolute md:left-auto md:right-2 md:bottom-2 md:translate-x-0 px-3 py-2 text-sm bg-green-500 text-white rounded">
                Files
            </button>
        </div>
    );
}
