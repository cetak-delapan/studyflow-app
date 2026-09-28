import {NavLink} from "react-router-dom";

import {signOut} from "firebase/auth";

import {auth} from "../services/firebase";

import {useSidebar} from "../context/SidebarContext";



export default function Sidebar(){


const {
open,
setOpen,
collapsed,
setCollapsed
}=useSidebar();



async function logout(){

await signOut(auth);

window.location.href="/";

}



const menu=[

{
name:"Dashboard",
path:"/dashboard",
icon:"🏠"
},

{
name:"Tugas",
path:"/tasks",
icon:"📝"
},

{
name:"Planner",
path:"/planner",
icon:"📅"
},

{
name:"Analitik",
path:"/analytics",
icon:"📊"
},

{
name:"Asisten AI",
path:"/ai",
icon:"🤖"
}

];



return(

<>


{/* Overlay Mobile */}

{

open &&

<div

onClick={()=>setOpen(false)}

className="
fixed
inset-0
bg-black/50
z-40
md:hidden
"

/>

}





<aside

className={`
fixed
top:0
left:0
z-50
h-screen
bg-slate-900
text-white
p-5
flex
flex-col
transition-all
duration-300

${

collapsed

?

"w-20"

:

"w-64"

}


${

open

?

"translate-x-0"

:

"-translate-x-full md:translate-x-0"

}

`}

>


<h1 className="
text-3xl
font-bold
mb-10
text-center
">


{

collapsed

?

<span className="text-blue-400">
SF
</span>

:

<>

Study<span className="text-blue-400">
Flow
</span>

</>

}



</h1>


<button

onClick={()=>setCollapsed(!collapsed)}

className="
hidden
md:flex
absolute
right-[-14px]
top-10
items-center
justify-center
w-8
h-8
rounded-full
bg-blue-600
text-white
shadow-lg
hover:bg-blue-700
transition
border-4
border-gray-100
"

>

{

collapsed

?

"→"

:

"←"

}

</button>


<nav className="
space-y-3
flex-1
overflow-y-auto
">


{

menu.map((item)=>(


<NavLink

key={item.path}

to={item.path}

onClick={()=>setOpen(false)}

className={({isActive})=>

`

flex
items-center
gap-3
p-3
rounded-xl

${
isActive

?

"bg-blue-600"

:

"hover:bg-slate-800"

}

`

}

>

<span>

{item.icon}

</span>


{

!collapsed &&

<span>

{item.name}

</span>

}


</NavLink>


))

}



</nav>






<button

onClick={logout}

className="
w-full
mt-auto
bg-red-500
hover:bg-red-600
p-3
rounded-xl
transition
"

>

{

collapsed

?

"🚪"

:

"🚪 Keluar"

}


</button>




</aside>


</>

)

}