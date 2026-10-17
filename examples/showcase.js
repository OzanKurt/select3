import { createSelect3 } from '@ozankurt/select3';
import '@ozankurt/select3/css';

const params = new URLSearchParams(location.search);
document.documentElement.dataset.scheme = params.get('scheme') ?? 'light';

// Initials avatars drawn on a canvas, so the page needs no image files and looks the same every run.
const avatar = (initials, hue) => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
    const g = canvas.getContext('2d');
    g.fillStyle = `hsl(${hue} 55% 46%)`;
    g.beginPath();
    g.arc(32, 32, 32, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = '600 26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(initials, 32, 34);

    return canvas.toDataURL('image/png');
};

[...document.querySelectorAll('#reviewers option')].forEach((option, index) => {
    const initials = option.textContent.split(' ').map((part) => part[0]).join('');
    option.dataset.image = avatar(initials, (index * 57 + 200) % 360);
});

const select = (id) => document.getElementById(id);

window.showcase = {
    office: createSelect3(select('office'), { placeholder: 'Pick an office', fuzzy: true }),
    reviewers: createSelect3(select('reviewers'), { selectAll: true, checkboxes: true, closeOnSelect: false }),
    timezone: createSelect3(select('timezone'), { searchField: ['label', 'meta'], searchGroups: true, allowClear: false }),
    labels: createSelect3(select('labels'), { tags: true, placeholder: 'Add labels' }),
};

document.fonts.ready.then(() => {
    document.body.dataset.ready = 'true';
});
