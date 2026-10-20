Change Begins/Ends to a single "When" attribute that supports a single time or a range (for a single-time the begin/end time of the range are simply identical/linked). Migrate existing times to support "When" (make begins/ends match for items that only have one).

When selecting a time show a "Range" toggle (off by default). When the toggle is turned on, reveal the second date and time fields (set to the same date and time as the first). When the toggle is turned off, the second date/time fields are hidden (and internally the begin/end time are set to match).

Tasks are due before the end of the range, but can show up on filtered views as soon as the range overlaps.

The default "When" attribute should already select today's date. We need to more clearly indicate that time is optional.

Add an "Until" field to the repeats attribute. it can be "Forever" or a specific date. When you copy an item that repeats forever there should be an option to essentially cut off the original, and make the copy the new one moving forward.

Money should, instead of a drop down, use a "Planned"/"Tracked" toggle/slider. Whether it is income or expense is based on the sign of the amount. Update the UI to reflect that this item is income or expense when the amount changes.

Budget items should have a special button that opens a new item form that populates to a tracked amount. The button is "track income" or "track expense" depending on the budget item. It doesn't create the item yet until the user saves the new item. The new item is automatically named "Income for (name)" or "Expense for (name)", includes a note, a when, and a money attribute with the appropriate settings selected ("Tracked", the specific item, no amount).

A budget item that is a task, when checked by the user, should open a confirmation dialog asking if the user wants to create an income/expense item to track it. Selecting yes will open the new item form again (same as track income/track expense) but instead of no amount, it will be the set to the matching amount of the task.


For non-technical users, scrolling on the board should handle zoom behavior without holding ctrl.

Attribute buttons should appear in the following order.
- Note
- Task
- (Waiting) when the item has a "Task" attribute
- List
- Who
- When
- (Repeats) when the item has a "When" attribute
- Where
- Money
- Files
- Color
- Group
- Tags

The Delete button on an item should match the color of the item.

The files attribute should show an image preview of each image by default (below the file upload field). Clicking on the image opens it in the image preview popup used by the board.

When checking off a non-repeating task, there should be a confirmation dialog that asks if you would like to delete it or keep it (default behavior).

When deleting an item, there should be a proper confirmation dialog instead of an alert/prompt.