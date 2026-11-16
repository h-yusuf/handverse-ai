import {createRoot} from 'react-dom/client';
import {Component,type ReactNode} from 'react';
import App from './App';
import {GlobalHandTrackingProvider} from './HandTrackingProvider';
import './styles.css';
class Boundary extends Component<{children:ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true}}render(){return this.state.error?<div style={{padding:60,color:'#bdeaf0',fontFamily:'sans-serif'}}><h1>Let’s get you back to play.</h1><p>The arcade encountered an unexpected error.</p><button onClick={()=>location.reload()}>Restart HANDVERSE</button></div>:this.props.children;}}
createRoot(document.getElementById('root')!).render(<Boundary><GlobalHandTrackingProvider><App/></GlobalHandTrackingProvider></Boundary>);
