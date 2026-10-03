import React from 'react';

const REACTIONS = ['🔥', '😂', '💀', '👑', '🧢', '🫡'];

interface ReactionBarProps {
  reactions: Record<string, string[]>;
  currentUserId: string;
  onReact: (emoji: string) => void;
}

export function ReactionBar({ reactions, currentUserId, onReact }: ReactionBarProps) {
  return (
    <div className="reaction-bar">
      {REACTIONS.map((emoji) => {
        const users = reactions[emoji] || [];
        const hasReacted = users.includes(currentUserId);
        return (
          <button
            key={emoji}
            className={`reaction-btn${hasReacted ? ' reacted' : ''}`}
            onClick={() => onReact(emoji)}
            aria-label={`React with ${emoji}`}
          >
            <span>{emoji}</span>
            {users.length > 0 && (
              <span className="reaction-count num">{users.length}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
