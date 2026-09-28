import {useState, useEffect} from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import MobileNavbar from "../components/MobileNavbar";

import {
collection,
getDocs,
query,
where
} from "firebase/firestore";

import {db} from "../services/firebase";

import {useAuth} from "../context/AuthContext";
import {useSidebar} from "../context/SidebarContext";


export default function Dashboard(){


const {
collapsed
}=useSidebar();


const {
user
}=useAuth();



const [activeTasks,setActiveTasks]=useState(0);

const [completedTasks,setCompletedTasks]=useState(0);

const [totalHours,setTotalHours]=useState(0);

const [nearestDeadline,setNearestDeadline]=useState(null);






useEffect(()=>{


async function loadDashboard(){


if(!user) return;



const q=query(

collection(db,"tasks"),

where(
"userId",
"==",
user.uid
)

);



const snapshot=await getDocs(q);



const tasks=snapshot.docs.map((item)=>({

id:item.id,

...item.data()

}));





// tugas aktif

const active = tasks.filter(

(item)=>

item.status==="pending"

).length;





// tugas selesai

const completed = tasks.filter(

(item)=>

item.status==="completed"

).length;





// total durasi

const hours = tasks.reduce(

(total,item)=>{


return total + Number(item.duration || 0);


},

0

);






// deadline terdekat

const sortedTasks=[...tasks].sort(

(a,b)=>

new Date(a.deadline)

-

new Date(b.deadline)

);



setActiveTasks(active);

setCompletedTasks(completed);

setTotalHours(hours);



if(sortedTasks.length>0){

setNearestDeadline(sortedTasks[0]);

}



}



loadDashboard();



},[user]);









return(

<div className="
flex
bg-gray-100
min-h-screen
">



<Sidebar/>





<main

className={`

flex-1

p-8

transition-all

duration-300


${
collapsed

?

"ml-20"

:

"ml-64"

}

`}

>


<MobileNavbar/>

<Navbar/>








<div className="
grid
grid-cols-1
md:grid-cols-3
gap-6
">



<StatCard

title="Tugas Aktif"

value={activeTasks}

icon="📝"

/>





<StatCard

title="Total Durasi"

value={`${totalHours} Jam`}

icon="📚"

/>





<StatCard

title="Tugas Selesai"

value={completedTasks}

icon="✅"

/>





</div>









<div className="
mt-8
grid
grid-cols-1
lg:grid-cols-2
gap-6
">






{/* Deadline Terdekat */}



<div className="
bg-white
p-6
rounded-2xl
shadow
">


<h2 className="
text-xl
font-bold
mb-4
">

📅 Deadline Terdekat

</h2>




{

nearestDeadline ?


<>


<p className="
text-lg
font-semibold
">

{nearestDeadline.title}

</p>



<p className="
text-gray-500
mt-2
">

Mata Kuliah:
{nearestDeadline.course || "-"}

</p>




<p className="
text-gray-500
">

Deadline:
{nearestDeadline.deadline}

</p>


</>


:


<p className="
text-gray-400
">

Belum ada tugas

</p>


}





</div>









{/* AI */}



<div className="
bg-gradient-to-r
from-blue-600
to-purple-600
text-white
p-6
rounded-2xl
">


<h2 className="
text-xl
font-bold
">

🤖 StudyFlow AI

</h2>



<p className="
mt-4
">

Belum ada rekomendasi.
Tambahkan tugas untuk mendapatkan analisis AI.

</p>



</div>








</div>







</main>



</div>


)


}