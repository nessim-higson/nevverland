// ─────────────────────────────────────────────────────────────
// Navigation content. Edit freely — every mode adapts to any
// depth / branching factor. `id` must be unique.
//   copy — small text block shown when the node is in focus
//          (STRUCTURE / IMAGERY modes)
//   img  — the node's image (IMAGERY mode; uniqlock stills in
//          public/img)
// ─────────────────────────────────────────────────────────────
export const NAV = {
  id: 'nevverland',
  label: 'Nevverland',
  copy: 'An experimental practice. Navigation as material, type as structure, imagery as weather. Built fast, kept forever — every study frozen the moment it works.',
  img: 'img/03.jpg',
  children: [
    {
      id: 'work',
      label: 'Work',
      copy: 'Studies in interfaces that behave like places — each one rebuilds a piece of the 2007 spatial web with today’s physics.',
      img: 'img/07.jpg',
      children: [
        // `media` turns a leaf into WORK: arriving collapses the nav
        // into a live miniature and the media takes the stage.
        {
          id: 'nike', label: 'Nike', img: 'img/00.jpg',
          copy: 'Motion identity sprints. Twelve directions in ten days.',
          media: [
            { type: 'video', src: 'img/nike.mp4' },
            { type: 'img', src: 'img/00.jpg' },
            { type: 'img', src: 'img/03.jpg' },
            { type: 'img', src: 'img/05.jpg' },
          ],
        },
        {
          id: 'hbo', label: 'HBO', img: 'img/14.jpg',
          copy: 'Title sequences as navigation. The menu is the trailer.',
          media: [
            { type: 'img', src: 'img/14.jpg' },
            { type: 'video', src: 'img/hbo.mp4' },
            { type: 'img', src: 'img/11.jpg' },
          ],
        },
        {
          id: 'sony', label: 'Sony', img: 'img/17.jpg',
          copy: 'Product stories told through a bent lens.',
          media: [
            { type: 'img', src: 'img/17.jpg' },
            { type: 'img', src: 'img/09.jpg' },
            { type: 'video', src: 'img/sony.mp4' },
            { type: 'img', src: 'img/07.jpg' },
          ],
        },
        {
          id: 'pepsi', label: 'Pepsi', img: 'img/21.jpg',
          copy: 'Liquid type systems for a liquid product.',
          media: [
            { type: 'img', src: 'img/21.jpg' },
            { type: 'img', src: 'img/34.jpg' },
            { type: 'img', src: 'img/38.jpg' },
          ],
        },
        {
          id: 'experimental', label: 'Experimental', img: 'img/28.jpg',
          copy: 'The unbriefed work. Where the other four came from.',
          media: [
            { type: 'video', src: 'img/experimental.mp4' },
            { type: 'img', src: 'img/28.jpg' },
            { type: 'img', src: 'img/11.jpg' },
            { type: 'img', src: 'img/09.jpg' },
          ],
        },
      ],
    },
    {
      id: 'about',
      label: 'About',
      copy: 'Nevverland is the studio of Nessim Higson — I AM ALWAYS HUNGRY. Twenty years of brand and interactive work, currently obsessed with making the web feel hand-made again. Small team, long leash, no templates.',
      img: 'img/05.jpg',
      children: [
        { id: 'studio', label: 'Studio', img: 'img/09.jpg', copy: 'A room with good light, too many books, and a server that never sleeps.' },
        { id: 'people', label: 'People', img: 'img/11.jpg', copy: 'One founder, many collaborators, several machines that think.' },
        { id: 'process', label: 'Process', img: 'img/34.jpg', copy: 'Prototype first. Theory later, if ever. Ship the sketch.' },
      ],
    },
    {
      id: 'info',
      label: 'Info',
      copy: 'Field notes and colophon. Set in Helvetica because the grid deserves respect; broken on purpose where it doesn’t. All imagery from the Uniqlock sessions.',
      img: 'img/38.jpg',
      children: [
        { id: 'notes', label: 'Notes', img: 'img/03.jpg', copy: 'Working notes from each experiment, unedited.' },
        { id: 'colophon', label: 'Colophon', img: 'img/05.jpg', copy: 'React + d3-force for the organic modes; just slots and springs for the structural ones.' },
        { id: 'archive', label: 'Archive', img: 'img/07.jpg', copy: 'Frozen versions of everything, kept forever.' },
      ],
    },
    {
      id: 'contact',
      label: 'Contact',
      copy: 'Always hungry. Say hello.',
      img: 'img/09.jpg',
      children: [
        { id: 'newyork', label: 'New York', img: 'img/11.jpg', copy: 'EST, for now.' },
        { id: 'losangeles', label: 'Los Angeles', img: 'img/14.jpg', copy: 'Golden hour, permanently.' },
        { id: 'email', label: 'Email', img: 'img/21.jpg', copy: 'ness@iamalwayshungry.com' },
      ],
    },
  ],
}
