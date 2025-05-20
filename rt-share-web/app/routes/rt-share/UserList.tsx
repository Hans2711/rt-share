import type { User } from "./types";

interface UserListProps {
  users: User[];
  currentUser: string;
  selectedUser: string | null;
  isOnline: boolean;
  onSelect: (id: string) => void;
}

export function UserList({ users, currentUser, selectedUser, isOnline, onSelect }: UserListProps) {
  const heading = !isOnline
    ? "Waiting for Connection"
    : users.filter(u => u.id !== currentUser).length === 0
      ? "No Users"
      : `Users (You are ${currentUser})`;

  return (
    <div className="user-list">
      <h2>{heading}</h2>
      <ul>
        {users
          .filter(u => u.id !== currentUser)
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
