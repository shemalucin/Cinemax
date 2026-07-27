import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { AvatarRenderer } from "./AnimatedAvatar";
import {
  Search,
  Plus,
  UserPlus,
  MessageSquare,
  Crown,
  Shield,
  Circle,
  MoreVertical,
  X,
} from "lucide-react";

interface UserListSidebarProps {
  onlineUsers?: Array<{ id: string; name: string; avatar: string; role?: string }>;
  recentChats?: Array<{ id: string; name: string; avatar: string; lastMessage?: string; timestamp?: string }>;
  onUserClick?: (userId: string, userName: string, userAvatar: string) => void;
  onSearchUser?: (query: string) => void;
  onAddUser?: () => void;
  sidebarCollapsed?: boolean;
}

export const UserListSidebar: React.FC<UserListSidebarProps> = ({
  onlineUsers = [],
  recentChats = [],
  onUserClick,
  onSearchUser,
  onAddUser,
  sidebarCollapsed = false,
}) => {
  const { user, t } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"online" | "recent">("online");
  const [showAddUser, setShowAddUser] = useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearchUser) {
      onSearchUser(query);
    }
  };

  const filteredOnlineUsers = onlineUsers.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRecentChats = recentChats.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-white/5 overflow-hidden ${
        sidebarCollapsed ? "w-72" : "w-56"
      } flex-none transition-all duration-300`}
      style={{ background: "rgba(6,7,10,0.95)" }}
    >
      {/* Header */}
      <div className="flex-none p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">Users</h2>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Add user"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
          <input
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search users..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#39FF14]/40 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Add User Input */}
        {showAddUser && (
          <div className="mt-3 flex gap-2">
            <input
              placeholder="Enter username..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#39FF14]/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && onAddUser) {
                  onAddUser();
                  setShowAddUser(false);
                }
              }}
            />
            <button
              onClick={() => {
                if (onAddUser) onAddUser();
                setShowAddUser(false);
              }}
              className="px-3 py-2 rounded-lg bg-[#39FF14] text-black text-xs font-bold hover:bg-[#31dd11] transition-colors"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-none flex border-b border-white/5">
        <button
          onClick={() => setActiveTab("online")}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "online"
              ? "text-[#39FF14] border-b-2 border-[#39FF14]"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Online ({onlineUsers.length})
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "recent"
              ? "text-[#39FF14] border-b-2 border-[#39FF14]"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Recent ({recentChats.length})
        </button>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "online" ? (
          <div className="p-2">
            {filteredOnlineUsers.length === 0 ? (
              <div className="text-center py-8">
                <Circle className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
                <p className="text-xs text-neutral-500">No users online</p>
              </div>
            ) : (
              filteredOnlineUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onUserClick?.(u.id, u.name, u.avatar)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left"
                >
                  <div className="relative flex-shrink-0">
                    <AvatarRenderer value={u.avatar} size={36} initials={u.name[0]?.toUpperCase() || "?"} />
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-[#39FF14] rounded-full border-2 border-[#0a0a0a]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                      {u.role === "admin" && <Crown className="h-3 w-3 text-[#39FF14] flex-shrink-0" />}
                      {u.role === "mod" && <Shield className="h-3 w-3 text-blue-400 flex-shrink-0" />}
                    </div>
                    <p className="text-[10px] text-[#39FF14]">Online</p>
                  </div>
                  <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-neutral-400 hover:text-white transition-all">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="p-2">
            {filteredRecentChats.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
                <p className="text-xs text-neutral-500">No recent chats</p>
              </div>
            ) : (
              filteredRecentChats.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onUserClick?.(u.id, u.name, u.avatar)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left"
                >
                  <div className="relative flex-shrink-0">
                    <AvatarRenderer value={u.avatar} size={36} initials={u.name[0]?.toUpperCase() || "?"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                    <p className="text-[10px] text-neutral-500 truncate">{u.lastMessage || "Start a conversation"}</p>
                  </div>
                  <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-neutral-400 hover:text-white transition-all">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Current User Status */}
      {user && (
        <div className="flex-none p-3 border-t border-white/5">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5">
            <div className="relative flex-shrink-0">
              <AvatarRenderer value={user.avatar} size={32} initials={user.name[0]?.toUpperCase() || "?"} />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-[#39FF14] rounded-full border-2 border-[#0a0a0a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-[#39FF14]">Online</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
