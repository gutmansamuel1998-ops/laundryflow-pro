import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GripVertical, EyeOff, Eye, Plus, Trash2 } from "lucide-react";

export default function TripChecklist({ items, onToggleChecked, onToggleHidden, onReorder, onAdd, onDelete }) {
  const [newItem, setNewItem] = useState("");
  const visible = items.filter((i) => !i.hidden).sort((a, b) => a.order - b.order);
  const hidden = items.filter((i) => i.hidden);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(visible);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onReorder(reordered.map((item, idx) => ({ id: item.id, order: idx })));
  };

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onAdd(newItem.trim());
    setNewItem("");
  };

  return (
    <div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="trip-checklist">
          {(provided) => (
            <ul ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
              {visible.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(dragProvided) => (
                    <li
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2.5"
                    >
                      <span {...dragProvided.dragHandleProps} aria-label={`Reorder ${item.name}`} className="text-muted-foreground/50 cursor-grab">
                        <GripVertical className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <Checkbox
                        id={`item-${item.id}`}
                        checked={item.checked}
                        onCheckedChange={() => onToggleChecked(item)}
                        aria-label={`Mark ${item.name} as ${item.checked ? "not packed" : "packed"}`}
                      />
                      <label
                        htmlFor={`item-${item.id}`}
                        className={`flex-1 text-sm ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}
                      >
                        {item.name}
                      </label>
                      <button
                        onClick={() => onToggleHidden(item)}
                        aria-label={`Hide ${item.name} from checklist`}
                        className="text-muted-foreground/60 hover:text-foreground p-1"
                      >
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => onDelete(item)}
                        aria-label={`Delete ${item.name}`}
                        className="text-muted-foreground/60 hover:text-destructive p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      <div className="flex gap-2 mt-3">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add an item"
          aria-label="New checklist item name"
          className="rounded-xl"
        />
        <Button onClick={handleAdd} size="icon" className="rounded-xl shrink-0" aria-label="Add item to checklist">
          <Plus className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {hidden.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Hidden items</p>
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((item) => (
              <button
                key={item.id}
                onClick={() => onToggleHidden(item)}
                aria-label={`Unhide ${item.name}`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-secondary text-muted-foreground"
              >
                <Eye className="w-3 h-3" aria-hidden="true" /> {item.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}