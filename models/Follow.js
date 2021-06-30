const ObjectID = require("mongodb").ObjectID
const User = require("./User")

const usersCollections = require("../db").db().collection("users")
const followsCollections = require("../db").db().collection("follows")

let Follow = function (followedUsername, authorId) {
  this.followedUsername = followedUsername
  this.authorId = authorId
  this.errors = []
}

Follow.prototype.cleanUp = function () {
  if (typeof this.followedUsername != "string") {
    this.followedUsername = ""
  }
}

Follow.prototype.validate = async function (action) {
  // followedUsername must exist
  let followedAccount = await usersCollections.findOne({
    username: this.followedUsername
  })
  if (followedAccount) {
    this.followedId = followedAccount._id
  } else {
    this.errors.push("User does not exists")
  }

  let doesFollowAlreadyExists = await followsCollections.findOne({
    followedId: this.followedId,
    authorId: new ObjectID(this.authorId)
  })
  if (action == "create") {
    if (doesFollowAlreadyExists) {
      this.errors.push("You are already following this user.")
    }
  }
  if (action == "delete") {
    if (!doesFollowAlreadyExists) {
      this.errors.push("You are not following this user.")
    }
  }

  // should not be able to follow oneself
  if (this.followedId.equals(this.authorId)) {
    this.errors.push("You cannot follow yourself.")
  }
}

Follow.prototype.create = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp()
    await this.validate("create")
    if (!this.errors.length) {
      await followsCollections.insertOne({
        followedId: this.followedId,
        authorId: new ObjectID(this.authorId)
      })
      resolve()
    } else {
      reject(this.errors)
    }
  })
}

Follow.prototype.delete = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp()
    await this.validate("delete")
    if (!this.errors.length) {
      await followsCollections.deleteOne({
        followedId: this.followedId,
        authorId: new ObjectID(this.authorId)
      })
      resolve()
    } else {
      reject(this.errors)
    }
  })
}

Follow.isVisitorFollowing = async function (followedId, visitorId) {
  let followDoc = await followsCollections.findOne({
    followedId: followedId,
    authorId: new ObjectID(visitorId)
  })
  if (followDoc) {
    return true
  } else {
    return false
  }
}

Follow.getFollowersById = function (id) {
  return new Promise(async (resolve, reject) => {
    try {
      let followers = await followsCollections
        .aggregate([
          { $match: { followedId: id } },
          {
            $lookup: {
              from: "users",
              localField: "authorId",
              foreignField: "_id",
              as: "userDoc"
            }
          },
          {
            $project: {
              username: { $arrayElemAt: ["$userDoc.username", 0] },
              email: { $arrayElemAt: ["$userDoc.email", 0] }
            }
          }
        ])
        .toArray()
      followers = followers.map(follower => {
        let user = new User(follower, true)
        return {
          username: follower.username,
          avatar: user.avatar
        }
      })
      resolve(followers)
    } catch (e) {
      reject(e)
    }
  })
}

Follow.getFollowingById = function (id) {
  return new Promise(async (resolve, reject) => {
    try {
      let followers = await followsCollections
        .aggregate([
          { $match: { authorId: id } },
          {
            $lookup: {
              from: "users",
              localField: "followedId",
              foreignField: "_id",
              as: "userDoc"
            }
          },
          {
            $project: {
              username: { $arrayElemAt: ["$userDoc.username", 0] },
              email: { $arrayElemAt: ["$userDoc.email", 0] }
            }
          }
        ])
        .toArray()
      followers = followers.map(follower => {
        let user = new User(follower, true)
        return {
          username: follower.username,
          avatar: user.avatar
        }
      })
      resolve(followers)
    } catch (e) {
      reject(e)
    }
  })
}

Follow.countFollowersById = function (id) {
  return new Promise(async (resolve, reject) => {
    let followerCount = await followsCollections.countDocuments({
      followedId: id
    })
    resolve(followerCount)
  })
}

Follow.countFollowingById = function (id) {
  return new Promise(async (resolve, reject) => {
    let followingCount = await followsCollections.countDocuments({
      authorId: id
    })
    resolve(followingCount)
  })
}

module.exports = Follow
