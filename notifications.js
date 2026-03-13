// notifications.js

function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade');
    }, duration);

    setTimeout(() => {
        document.body.removeChild(toast);
    }, duration + 500);
}

// Usage
// showToast('This is a toast notification!');

// CSS styles for the toast (to be included in your CSS file):
// .toast {
//     position: fixed;
//     bottom: 20px;
//     right: 20px;
//     background-color: #333;
//     color: white;
//     padding: 15px;
//     border-radius: 5px;
//     opacity: 0.9;
//     transition: opacity 0.5s;
// }
// .toast.fade {
//     opacity: 0;
// }