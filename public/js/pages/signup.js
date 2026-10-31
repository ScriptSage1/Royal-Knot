// Sign-up: show the "new workspace" or "invite code" field for the chosen mode.
const form = document.querySelector('.auth-form');
const sync = () => {
  const mode = form.querySelector('input[name="mode"]:checked').value;
  form.querySelectorAll('[data-show-for]').forEach((el) => {
    el.hidden = el.dataset.showFor !== mode;
    el.querySelector('input').required = !el.hidden && mode === 'join';
  });
};
form.addEventListener('change', (e) => { if (e.target.name === 'mode') sync(); });
sync();
