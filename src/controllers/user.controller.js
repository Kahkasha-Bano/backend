import {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens=async (userId)=>{
    try{
        const user=await User.findById(userId);
       const accessToken= user.generateAccessToken();
       const refreshToken= user.generateRefreshToken();

       user.refreshToken=refreshToken
      await user.save({validateBeforeSave: false})

      return {accessToken,refreshToken}

        
    }catch (error){
        throw new ApiError(500,"Something went wrong while generating refresh ans access token");
    }
}

 const registerUser = asyncHandler( async (req, res) => {
    console.log("Received Files: ", req.files);  // ✅ Log files to debug
    console.log("Received Body:", req.body); 
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {fullName, email, username, password } = req.body
    //console.log("email: ", email);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    console.log(req.files);

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    const avatarLocalPath = req.files?.avatar?.[0]?.path
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    //console.log(avatarLocalPath)

    //const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath=req.files.coverImage[0].path;
    }

    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    console.log(avatar)
    console.log(avatar?.url)
    if (!avatar || !avatar?.url) {
        throw new ApiError(400, "Avatar file is required")
    }
   

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

export const uploadAvatar = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Avatar file is required" });
    }
    res.json({ message: "File uploaded successfully", filename: req.file.filename });
};

const loginUser=asyncHandler(async(req,res) => {
   // req body se data le aao
   // userName or email le aao
   // find the user
   // password check
   // access and referesh token
   // send cookies


   const {email,username,password} =req.body
   if(!username && !email){
    throw new ApiError(400,"usename or password is required")
   }


   const user= await User.findOne({
    $or: [{username},{email}]
   })

   if(!user){
    throw new ApiError(404, "User does not exist")
   }

   const isPasswordValid=await user.isPasswordCorrect(password)

   if(!isPasswordValid){
    throw new ApiError(401, "Password incorrect")
   }

  const {accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id)

  const loggedInUser=await User.findById(user._id).select("-password -refreshToken")

  const options={
    httpOnly:true,
    secure:true
  }
  return res.status(200).
  cookie("accessToken",accessToken,options).
  cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
        200,{
            user:loggedInUser,accessToken,refreshToken
        },
        "User logged in Successfully"
    )
  )

})

const logoutUser = asyncHandler(async (req,res) =>{
   await  User.findByIdAndUpdate(
        req.user._id,{
            $set:
            {refreshToken:
                undefined
            }
        },{
            new:true
        }
    )
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logOut successfully"))
})

const refreshAccessToken= asyncHandler(async (req, res)=>{
    const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken)
{
    throw new ApiError(401," unauthorised request")
}

try {
    const decodedToken= jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )
    
    const user= User.findById(decodedToken?._id)
    if(!user)
        {
            throw new ApiError(401," invalid refresh token")
        }
    
        if(incomingRefreshToken!== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options= {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, refreshToken}= await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed" 
            )
        )
} catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
}

})


const changeCurrentPassword= asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword}= req.body
    const user= await User.findById(req.user?._id)
    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password")
    }

    user.password= newPassword;
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser= asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(
        200, 
        req.user, 
        "Current user fetched successfully"))
})

const updateAccountDetails= asyncHandler(async(req,res)=>{
    const {fullName, email}= req.body

    if(!fullName || !email){
        throw new ApiError(400, "All feilds are required")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,{
            $set:{
                fullName: fullName,
                email: email
            }
        },
        {
            new:true
        }
    ).select("-password ")

    return res
    .status(200)
    .josn(new ApiResponse(200, user, "Account details updated Successfully"))
})


const updateUserAvatar= asyncHandler(async(req, res)=>{
    const avatarLocalPath= req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "error while uploading on avatar")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
    {
        $set:{
            avatar: avatar.url
        }
    },{new: true}
).select("-password")

return res
.status(200)
.json(
    new ApiResponse(200, user, "Avatar updated successfully")
)
})



const updateUserCoverImage= asyncHandler(async(req, res)=>{
    const coverImageLocalPath= req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage= await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "error while uploading cover image")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
    {
        $set:{
            coverImage: coverImage.url
        }
    },{new: true}
).select("-password")


return res
.status(200)
.json(
    new ApiResponse(200, user, "Cover image updated successfully")
)
})

const getUserChannelProfile= asyncHandler(async(req, res)=>{
    const {username}= req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel= await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {$lookup:{
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
        }},
        {
            $addFields:{
                subscribersCount:{
                    $size:"subscribers"
                },
                channelsSubscribedToCount:{
                     $size: "$subscribedTo"
                },
                isSuscribed:{
                    $cond:{
                        if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false,
                    }
                }
            }
        },
        {
            $project: {
                fullName:1,
                username: 1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSuscribed:1,
                email:1,
                avatar:1,
                coverImage:1
            }
        }
    ])
    if(!channel?.length){
        throw new ApiError(404, "Channel does not exists")
    }

    return res.status(200)
    .json(
        new ApiResponse(200, "User channel fetched successfully")
    )
})


const getWatchHistory= asyncHandler(async(req,res)=>{
    const user= await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from : "videos",
                localField:"watchHistory",
                foreignField: "_id",
                as:" watchHistory",
                pipeline:[{
                    $lookup:{
                        from :"users",
                        localField:"owner",
                        foreignField: "_id",
                        as:"owner",
                        pipeline:[
                            {
                                $project:{
                                    fullName:1,
                                    username:1,
                                    avatar:1,
                                }
                            }
                        ]
                    }
                },{
                    $addFields:{
                        owner:{
                            $first:"$owner"
                        }
                    }
                }
            ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user[0].getWatchHistory,
            "Watch history fetched successfully"
        )
    )
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getWatchHistory, 
    getUserChannelProfile
}