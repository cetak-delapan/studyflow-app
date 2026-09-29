import {BrowserRouter,Routes,Route} from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Planner from "./pages/Planner";


function App(){

return(

<BrowserRouter>

<Routes>


<Route 
path="/"
element={<Login/>}
/>


<Route 
path="/register"
element={<Register/>}
/>


<Route 
path="/dashboard"
element={<Dashboard/>}
/>


<Route
path="/tasks"
element={<Tasks/>}
/>


<Route
path="/planner"
element={<Planner/>}
/>

</Routes>

</BrowserRouter>

)

}


export default App;