import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import App from './App'
import {PinnedPostWindow} from './components/posts/pinned-post-window'
import {pinnedPostIdFromUrl} from './lib/pinned-post'
import './styles.css'

const pinnedPostId = pinnedPostIdFromUrl(window.location.search)
if (pinnedPostId) document.documentElement.classList.add('pinned-post')

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
    <React.StrictMode>
        {pinnedPostId ? <PinnedPostWindow postId={pinnedPostId}/> : <App/>}
    </React.StrictMode>
)
