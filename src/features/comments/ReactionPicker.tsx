import { useState, type ReactNode } from "react";
import EmojiPicker, { EmojiStyle, Theme as EmojiTheme } from "emoji-picker-react";

import { IconSmilePlus } from "@/components/icons/figma";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Three quick-pick emojis match the Figma's resting popover state. */
const QUICK_EMOJIS = ["👍", "👀", "💩"];

/**
 * Compact reaction picker mounted on the per-comment "add reaction"
 * button. Shows three quick emojis inline + a "more" trigger that swaps
 * the popover content for the full emoji-picker-react palette. Either
 * path calls `onPick(emoji)` and closes.
 */
export function ReactionPicker({
  trigger,
  onPick,
}: {
  trigger: ReactNode;
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);

  const pick = (emoji: string) => {
    onPick(emoji);
    setOpen(false);
    setShowFullPicker(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reset the "more" panel state when the popover closes so the
        // next open lands back on the quick row.
        if (!next) setShowFullPicker(false);
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          // Quick row sits tight; full picker needs the bigger card.
          showFullPicker ? "p-0 w-auto" : "p-1 w-auto"
        )}
      >
        {showFullPicker ? (
          <EmojiPicker
            onEmojiClick={(data) => pick(data.emoji)}
            theme={EmojiTheme.LIGHT}
            emojiStyle={EmojiStyle.NATIVE}
            width={320}
            height={400}
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
          />
        ) : (
          <div className="flex items-center gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => pick(emoji)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-base hover:bg-[#EDF2F4] transition-colors"
                aria-label={`React with ${emoji}`}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFullPicker(true)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[#708597] hover:bg-[#EDF2F4] hover:text-foreground transition-colors"
              aria-label="More reactions"
              title="More reactions"
            >
              <IconSmilePlus className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
