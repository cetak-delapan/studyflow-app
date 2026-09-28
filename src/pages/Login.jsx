import {useState} from "react";
import {signInWithEmailAndPassword} from "firebase/auth";
import {auth} from "../services/firebase";
import {useNavigate} from "react-router-dom";


export default function Login(){


const navigate = useNavigate();


const [email,setEmail]=useState("");

const [password,setPassword]=useState("");



const handleLogin=async(e)=>{

e.preventDefault();


try{


await signInWithEmailAndPassword(

auth,

email,

password

);


alert("Login berhasil");


navigate("/dashboard");


}catch(error){


alert(error.message);


}


};



return(

<div className="
min-h-screen
flex
items-center
justify-center
bg-gray-100
">


<form

onSubmit={handleLogin}

className="
bg-white
shadow-xl
rounded-2xl
p-8
w-full
max-w-md
"


>


<h1 className="
text-3xl
font-bold
mb-6
text-center
">

Login StudyFlow

</h1>



<input

placeholder="Email"

onChange={(e)=>setEmail(e.target.value)}

className="input"

/>



<input

type="password"

placeholder="Password"

onChange={(e)=>setPassword(e.target.value)}

className="input"

/>



<button

className="
bg-blue-600
text-white
w-full
py-3
rounded-xl
mt-4
"

>

Login

</button>



</form>


</div>


)

}