import {useEffect,useState} from "react";

import {
doc,
getDoc
}
from "firebase/firestore";


import {db} from "../services/firebase";

import {useAuth} from "../context/AuthContext";



export default function Navbar(){



const {user}=useAuth();


const [profile,setProfile]=useState(null);

const hour = new Date().getHours();


let greeting="Selamat Pagi";


if(hour>=12 && hour<18){

greeting="Selamat Siang";

}

else if(hour>=18){

greeting="Selamat Malam";

}


useEffect(()=>{


async function getProfile(){


if(!user)return;



const ref=doc(

db,

"users",

user.uid

);



const snap=await getDoc(ref);



if(snap.exists()){


setProfile(snap.data());


}


}


getProfile();


},[user]);





return(


<div className="
flex
justify-between
items-center
mb-8
">


<div>


<h1 className="
text-3xl
font-bold
text-gray-800
">


{greeting},

{

profile?.name || "Mahasiswa"

}

👋


</h1>




<p className="text-gray-500 mt-1">
Mahasiswa Program Studi {profile?.major || ""}
</p>


</div>




</div>


)


}