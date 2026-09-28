import {useSidebar} from "../context/SidebarContext";


export default function MobileNavbar(){


const {setOpen}=useSidebar();



return(

<div className="
md:hidden
flex
items-center
justify-between
bg-slate-900
text-white
p-4
">


<button

onClick={()=>setOpen(true)}

className="
text-2xl
"

>

☰

</button>



<h1 className="
text-xl
font-bold
">

Study<span className="text-blue-400">

Flow

</span>

</h1>



<div>

👤

</div>


</div>


)

}