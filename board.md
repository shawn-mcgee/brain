The board is an interesting feature.


The board is an infinite canvas that can be used to represent important data in a visually-rich manner.

Entry cards on the board are connected to corresponding entries in the backend. Calendar views are stored independently.

Each entry has a required name and a unique ID. Names may collide; references use IDs. A note is an optional enhancement: it becomes a sticky note's body or the description beneath a polaroid.

### Elements

All board elements are a visual card with the following features.

1. A header with a draggable handle used to reposition the card
2. Color selection (circle that shows the current color, clicking on it opens a tiny menu to pick one of six or eight colors)
3. The name of the entry
4. A pin toggle (keeps the card from being dragged when active, off by default)
5. An archive button (which simply hides the card from the board)
6. A body with some content
7. A footer with special tags

#### Note
A note's default color is yellow. By default all entries appear as sticky notes, unless some other condition promotes it to a different card type.

#### Polaroid
A polaroid's default card color is white. A card becomes a polaroid when its entry has one or more images attached to it. 

When a polaroid has multiple images attached to it, the image on the card becomes a carousel with the first image as the default.

#### Calendar
A calendar's default card color is blue. A calendar is not an entry card, but is instead a special kind of view that can be pinned to the board. A calendar view can show a specific day, week, or month. A calendar view can also be dynamic (showing the current day, week, or month).
